// ===== Patternflow pattern =====
// Title:   Kuramoto-Sivashinsky
// Family:  noise
// Idea:    The Kuramoto-Sivashinsky equation u_t + u u_x + u_xx + u_xxxx = 0 runs on a ring as wide as the panel, one grid point per column, and each new moment of u enters at the top and scrolls down, so the 128 rows are its space-time diagram: cyan streaks where u is positive and magenta where it is negative wobble, split and merge in a chaotic braid, black where u crosses zero.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Kuramoto-Sivashinsky equation (Yoshiki Kuramoto, 1976; Gregory Sivashinsky, 1977), pattern round 37
// Round:   37
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Length=22..66, Dispersion=-1..1
//
// Knob 1: Hue. Turns both sides of the colour map round the wheel together. At 0 positive u is cyan and negative u magenta, black where u crosses zero and pale where |u| passes 2.6; at 0.3 gold and violet, at 0.6 orange and teal.
// Knob 2: Speed. Rows a second, 15 times the knob, and each row is 1.25 time units of the equation, so the panel always holds the last 160 time units. At 2 that is one row a frame and a moment takes 4.3 s from top to bottom; at 0.2 it takes 43 s.
// Knob 3: Length. The length L of the ring, 22 to 66. L / 2 pi is the number of linearly unstable modes, 3.5 at 22 and 10.5 at 66. At 22, the size Predrag Cvitanovic and his group studied, two fat cyan streaks wobble in step and now and then slip sideways all at once; at 66 about seven thin ones split and merge.
// Knob 4: Dispersion. A third-derivative term delta u_xxx, which makes it the Kawahara equation. At the start, 0.06, it is still Kuramoto-Sivashinsky; from about 0.15 at L 22 and 0.25 at L 66 the chaos settles into a train of pulses that lean one way across the diagram, right and cyan for positive delta, left and magenta for negative.
// Buttons: K1 tap dents the front at a random place: u gets a dipole of plus and minus 4 there, its two halves run apart, as u above zero travels right and u below it left, and they leave a calm patch in the braid that the streaks fill in again over 1 to 3 s.

// The solver is ETDRK4, the exponential time-differencing Runge-Kutta
// scheme of Steven Cox and Paul Matthews (2002), with the coefficients
// taken as means round a circle in the complex plane, the way Aly-Khan
// Kassam and Lloyd Trefethen (2005) do it, so they hold for every mode from
// the growing ones to the most damped. In Fourier space
//   v_t = (k^2 - k^4 + i delta k^3) v - (i k / 2) FFT(u^2),
// the linear part solved exactly and only u^2 stepped, 0.25 time units a
// step, five steps a row, 40 FFTs of size 64 a frame at Speed 2. At 0.4
// time units a row the streaks hardly bent in 128 rows; at 1.25 they braid.
//
// Checked over 10,000 time units from the same start at delta 0:
// - The energy, the mean of u^2, stays bounded: it averages 1.41 at L 22
//   and 1.71 at L 66, and never passes 3.13.
// - The fastest-growing wavelength is 2 pi sqrt 2, so a ring of length L
//   should hold about L / 8.89 cells. Counting the positive humps of u
//   (with a 0.4 dead band) gives 2.26 at L 22 against 2.48, 3.66 at 36
//   against 4.05, 5.34 at 50 against 5.63 and 6.89 at 66 against 7.43:
//   always 91 to 93 percent of it.
// - 64 grid points resolve the ring up to L 66, where the highest mode
//   never carries more than 0.65 percent of the largest. At L 100 it
//   reached 21 percent, so the knob stops at 66.
const W = 64, H = 128, N = 64, STEP = 0.25, ROW = 1.25, RATE = 15, MC = 32, PRERUN = 100;
const { floor, exp, cos, sin, abs, round, random, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// A complex FFT of size 64: bit reversal, then six rounds of butterflies.
const BR = new Uint8Array(N), CS = new Float64Array(N / 2), SN = new Float64Array(N / 2);
for (let i = 0; i < N; i++) {
  let r = 0;
  for (let b = 0, v = i; b < 6; b++, v >>= 1) r = (r << 1) | (v & 1);
  BR[i] = r;
}
for (let k = 0; k < N / 2; k++) (CS[k] = cos((TAU * k) / N)), (SN[k] = sin((TAU * k) / N));

function fft(re, im, sign) {
  for (let i = 0; i < N; i++) {
    const j = BR[i];
    if (j > i) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let i = 0; i < N; i += size)
      for (let k = 0; k < half; k++) {
        const wr = CS[k * step], wi = sign * SN[k * step], a = i + k, b = a + half;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = 255 * (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p);
  out[o + 1] = 255 * (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p);
  out[o + 2] = 255 * (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p);
}

const f64 = () => new Float64Array(N);

export function setup(params) {
  params.s = {
    ready: false, hue: -1, speed: 2, L: -1, delta: NaN, acc: 0, head: 0,
    vr: f64(), vi: f64(), g: f64(),
    Er: f64(), Ei: f64(), E2r: f64(), E2i: f64(), Qr: f64(), Qi: f64(),
    f1r: f64(), f1i: f64(), f2r: f64(), f2i: f64(), f3r: f64(), f3i: f64(),
    ar: f64(), ai: f64(), br: f64(), bi: f64(), cr: f64(), ci: f64(),
    Nvr: f64(), Nvi: f64(), Nar: f64(), Nai: f64(), Nbr: f64(), Nbi: f64(), Ncr: f64(), Nci: f64(),
    tr: f64(), ti: f64(), u: f64(),
    hist: new Float32Array(H * N), next: new Float32Array(N), lut: new Uint8Array(2 * 257 * 3),
  };
}

// The ETDRK4 coefficients for ring length L and dispersion delta. Mode n
// has wavenumber k = 2 pi n / L for n below 32 and 2 pi (n - 64) / L above;
// the Nyquist mode, n = 32, gets the damping of its true wavenumber but no
// share of the nonlinear term, as an odd derivative cannot be taken there.
function coefficients(S) {
  const { L, delta, g } = S;
  for (let n = 0; n < N; n++) {
    const kk = (TAU * (n < N / 2 ? n : n - N)) / L, kn = n === N / 2 ? (TAU * (N / 2)) / L : kk;
    g[n] = n === N / 2 ? 0 : -0.5 * kk;
    const zr = STEP * (kn * kn - kn * kn * kn * kn), zi = n === N / 2 ? 0 : STEP * delta * kk * kk * kk;
    let em = exp(zr);
    S.Er[n] = em * cos(zi);
    S.Ei[n] = em * sin(zi);
    em = exp(zr / 2);
    S.E2r[n] = em * cos(zi / 2);
    S.E2i[n] = em * sin(zi / 2);
    let qr = 0, qi = 0, a1 = 0, b1 = 0, a2 = 0, b2 = 0, a3 = 0, b3 = 0;
    for (let j = 0; j < MC; j++) {
      const th = (TAU * (j + 0.5)) / MC, lr = zr + cos(th), li = zi + sin(th);
      const ex = exp(lr), er = ex * cos(li), ei = ex * sin(li);
      const hx = exp(lr / 2), hr = hx * cos(li / 2), hi = hx * sin(li / 2);
      const l2r = lr * lr - li * li, l2i = 2 * lr * li;
      const l3r = l2r * lr - l2i * li, l3i = l2r * li + l2i * lr;
      const d1 = lr * lr + li * li, d3 = l3r * l3r + l3i * l3i;
      qr += ((hr - 1) * lr + hi * li) / d1;
      qi += (hi * lr - (hr - 1) * li) / d1;
      let pr = 4 - 3 * lr + l2r, pi = -3 * li + l2i;
      let nr = -4 - lr + er * pr - ei * pi, ni = -li + er * pi + ei * pr;
      a1 += (nr * l3r + ni * l3i) / d3;
      b1 += (ni * l3r - nr * l3i) / d3;
      pr = lr - 2;
      pi = li;
      nr = 2 + lr + er * pr - ei * pi;
      ni = li + er * pi + ei * pr;
      a2 += (nr * l3r + ni * l3i) / d3;
      b2 += (ni * l3r - nr * l3i) / d3;
      pr = 4 - lr;
      pi = -li;
      nr = -4 - 3 * lr - l2r + er * pr - ei * pi;
      ni = -3 * li - l2i + er * pi + ei * pr;
      a3 += (nr * l3r + ni * l3i) / d3;
      b3 += (ni * l3r - nr * l3i) / d3;
    }
    const m = STEP / MC;
    S.Qr[n] = qr * m;
    S.Qi[n] = qi * m;
    S.f1r[n] = a1 * m;
    S.f1i[n] = b1 * m;
    S.f2r[n] = a2 * m;
    S.f2i[n] = b2 * m;
    S.f3r[n] = a3 * m;
    S.f3i[n] = b3 * m;
  }
}

// N(v) = -(i k / 2) FFT(u^2), u the real part of the inverse FFT of v.
function nonlinear(S, xr, xi, outr, outi) {
  const { tr, ti, g } = S;
  for (let n = 0; n < N; n++) (tr[n] = xr[n]), (ti[n] = xi[n]);
  fft(tr, ti, 1);
  for (let j = 0; j < N; j++) {
    const u = tr[j] / N;
    tr[j] = u * u;
    ti[j] = 0;
  }
  fft(tr, ti, -1);
  for (let n = 0; n < N; n++) {
    outr[n] = -g[n] * ti[n];
    outi[n] = g[n] * tr[n];
  }
}

function step(S) {
  const { vr, vi, ar, ai, br, bi, cr, ci, Nvr, Nvi, Nar, Nai, Nbr, Nbi, Ncr, Nci, E2r, E2i, Qr, Qi } = S;
  nonlinear(S, vr, vi, Nvr, Nvi);
  for (let n = 0; n < N; n++) {
    ar[n] = E2r[n] * vr[n] - E2i[n] * vi[n] + Qr[n] * Nvr[n] - Qi[n] * Nvi[n];
    ai[n] = E2r[n] * vi[n] + E2i[n] * vr[n] + Qr[n] * Nvi[n] + Qi[n] * Nvr[n];
  }
  nonlinear(S, ar, ai, Nar, Nai);
  for (let n = 0; n < N; n++) {
    br[n] = E2r[n] * vr[n] - E2i[n] * vi[n] + Qr[n] * Nar[n] - Qi[n] * Nai[n];
    bi[n] = E2r[n] * vi[n] + E2i[n] * vr[n] + Qr[n] * Nai[n] + Qi[n] * Nar[n];
  }
  nonlinear(S, br, bi, Nbr, Nbi);
  for (let n = 0; n < N; n++) {
    const xr = 2 * Nbr[n] - Nvr[n], xi = 2 * Nbi[n] - Nvi[n];
    cr[n] = E2r[n] * ar[n] - E2i[n] * ai[n] + Qr[n] * xr - Qi[n] * xi;
    ci[n] = E2r[n] * ai[n] + E2i[n] * ar[n] + Qr[n] * xi + Qi[n] * xr;
  }
  nonlinear(S, cr, ci, Ncr, Nci);
  const { Er, Ei, f1r, f1i, f2r, f2i, f3r, f3i } = S;
  for (let n = 0; n < N; n++) {
    const sr = Nar[n] + Nbr[n], si = Nai[n] + Nbi[n];
    const nr =
      Er[n] * vr[n] - Ei[n] * vi[n] +
      (Nvr[n] * f1r[n] - Nvi[n] * f1i[n]) + 2 * (sr * f2r[n] - si * f2i[n]) + (Ncr[n] * f3r[n] - Nci[n] * f3i[n]);
    const ni =
      Er[n] * vi[n] + Ei[n] * vr[n] +
      (Nvr[n] * f1i[n] + Nvi[n] * f1r[n]) + 2 * (sr * f2i[n] + si * f2r[n]) + (Ncr[n] * f3i[n] + Nci[n] * f3r[n]);
    vr[n] = nr;
    vi[n] = ni;
  }
  // u is real, so v_(64-n) is the conjugate of v_n. Round-off breaks that,
  // and the broken part is invisible to u^2, so nothing holds it down: it
  // grew at the linear rate of modes 2 and 3, 0.19 a time unit at L = 22,
  // and blew the run up at t = 340. Folding it back each step keeps it at 0.
  for (let n = 1; n < N / 2; n++) {
    const a = 0.5 * (vr[n] + vr[N - n]), b = 0.5 * (vi[n] - vi[N - n]);
    vr[n] = vr[N - n] = a;
    vi[n] = b;
    vi[N - n] = -b;
  }
  vr[0] = vi[0] = vi[N / 2] = 0;
}

// u on the 64 grid points, one per column.
function physical(S, out) {
  const { tr, ti } = S;
  for (let n = 0; n < N; n++) (tr[n] = S.vr[n]), (ti[n] = S.vi[n]);
  fft(tr, ti, 1);
  for (let j = 0; j < N; j++) out[j] = tr[j] / N;
}

function advanceRow(S) {
  for (let s = 0, n = round(ROW / STEP); s < n; s++) step(S);
}

// The row just computed goes in at the head; `next` is one row ahead of it,
// so the top of the panel can slide between the two.
function pushRow(S) {
  S.head = (S.head + H - 1) % H;
  S.hist.set(S.next, S.head * N);
  advanceRow(S);
  physical(S, S.next);
}

// u is the slope of Sivashinsky's flame front, so a dent pushed into the
// front shows in u as a dipole, up on one side and down on the other: the
// derivative of a Gaussian, 4 columns wide, peaks of +-amp. It has no mean.
// A plain bump had one, and taking it off shifted the whole row by 0.78,
// a hard line straight across the diagram.
function kick(S, x0, amp) {
  const u = S.u;
  physical(S, u);
  for (let j = 0; j < N; j++) {
    let d = j - x0;
    if (d > N / 2) d -= N;
    if (d < -N / 2) d += N;
    const q = d / 4;
    S.tr[j] = u[j] + amp * 1.6487 * q * exp(-0.5 * q * q);
    S.ti[j] = 0;
  }
  fft(S.tr, S.ti, -1);
  for (let n = 0; n < N; n++) (S.vr[n] = S.tr[n]), (S.vi[n] = S.ti[n]);
  S.vr[0] = S.vi[0] = 0;
}

function start(S) {
  // Low modes with random phases, then PRERUN time units so the first
  // frame is already chaos, then a full panel of history.
  for (let n = 0; n < N; n++) S.vr[n] = S.vi[n] = 0;
  for (let n = 1; n <= 6; n++) {
    const ph = random() * TAU, a = (0.3 * N) / n;
    S.vr[n] = a * cos(ph);
    S.vi[n] = a * sin(ph);
    S.vr[N - n] = a * cos(ph);
    S.vi[N - n] = -a * sin(ph);
  }
  for (let s = 0, n = round(PRERUN / STEP); s < n; s++) step(S);
  physical(S, S.next);
  for (let r = 0; r < H; r++) pushRow(S);
  S.ready = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 22, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  const L = cl(k[2], 22, 66), delta = cl(k[3], -1, 1);
  if (L !== S.L || delta !== S.delta) {
    S.L = L;
    S.delta = delta;
    coefficients(S);
  }
  if (!S.ready) start(S);
  if (input.btnPressed && input.btnPressed[0]) kick(S, random() * N, 4);
  S.acc += d * S.speed * RATE;
  // 30 rows a second at 30 frames lands on 0.9999...; a hair of slack
  // keeps it one row a frame instead of none and then two.
  while (S.acc >= 1 - 1e-6) {
    S.acc = Math.max(0, S.acc - 1);
    pushRow(S);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const lut = S.lut;
  if (S.lutHue !== S.hue) {
    // Two ramps of 257 steps, positive u then negative: black at zero,
    // rising straight to full colour at |u| = 2.64, then paling to a tint at
    // 3.3. A straight ramp keeps the steps between neighbours soft; the
    // first, steeper ramp put a hard step on 23 percent of them.
    for (let side = 0; side < 2; side++) {
      const h = S.hue + (side === 0 ? 0.5 : 0.86);
      for (let i = 0; i <= 256; i++) {
        const a = i / 256, f = cl(a / 0.8, 0, 1), w = cl((a - 0.8) / 0.2, 0, 1);
        hsv(h + 0.05 * (f - 1), 1 - 0.55 * w, f, lut, (side * 257 + i) * 3);
      }
    }
    S.lutHue = S.hue;
  }
  // Pulses grow with the dispersion, |u| up to 3.5 at delta 0 and 4.7 at
  // delta 1, so the map stretches with it and the pulses do not wash out pale.
  const { hist, next, head, acc } = S, inv = 256 / (3.3 * (1 + 0.4 * abs(S.delta)));
  for (let y = 0; y < H; y++) {
    // Display row y is `acc` of the way from history row y - 1 to row y,
    // where row -1 is the one computed ahead.
    const a = y - acc, r0 = floor(a), t = a - r0;
    const A = r0 < 0 ? next : null, o0 = ((head + r0 + H) % H) * N, o1 = ((head + r0 + 1) % H) * N;
    for (let x = 0; x < W; x++) {
      const u0 = A ? A[x] : hist[o0 + x], u1 = r0 + 1 < H ? hist[o1 + x] : u0;
      const u = u0 + (u1 - u0) * t, i = Math.min(256, round(abs(u) * inv)), o = ((u < 0 ? 257 : 0) + i) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
  }
}
