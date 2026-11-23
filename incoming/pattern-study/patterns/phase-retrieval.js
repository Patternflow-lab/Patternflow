// ===== Patternflow pattern =====
// Title:   Phase Retrieval
// Family:  phaseretrieval
// Idea:    A hidden complex object of soft discs, rings and bars morphs and drifts while only the size of its Fourier transform is known, and a hybrid input-output iteration with a support constraint condenses the object out of phase noise in the top square, hue for phase and light for amplitude, while the bottom square shows the diffraction fringes of that estimate in log size and phase, until now and then the estimate is thrown back to noise and a different object is solved from scratch.
// Author:  patternflow-lab
// Date:    2026-11-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the phase problem of diffraction imaging, solved by alternating projections between the measured Fourier size and the object's support (Ralph Gerchberg and Owen Saxton, 1972), the error-reduction and hybrid input-output iterations (James Fienup, 1978 and 1982), their twin-image and striped stagnation (Fienup and Wackerman, 1986), the oversampling that makes the answer unique (David Sayre, 1952) and coherent diffraction imaging of a specimen that is not a crystal (Jianwei Miao, Pambos Charalambous, Janos Kirz and Sayre, 1999), the radix-2 fast Fourier transform (James Cooley and John Tukey, 1965), the picture drawn by domain colouring (Frank Farris, 1998), all from memory, pattern round 228
// Round:   228
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Feedback=0.3..3, Support=-1..1, Parts=-1..1
//
// Knob 1: Hue. Where the circle of phase colours starts, once round: at 0 the object's overall phase is cyan-blue and its parts run from teal to violet and lime-green round it, at 0.25 violet, at 0.5 pink-red, at 0.75 green, and back at 1. The colour of a pixel is its phase against the sum of the estimate, so turning the knob moves no phase, only the colours.
// Knob 2: Feedback. The negative feedback beta of the hybrid input-output step, 0.22 at 0.3, 0.46 at 1, 0.80 at 2 where it opens and 1.14 at 3, together with the iteration rate, 0.9 a second at 0.3, 2.4 at 1, 9.8 at 2 and 40 at 3. Low beta stagnates: at 0.3 the estimate stays a mottled blob with striped ghosts for minutes; at 2 a blob forms in about 2 seconds and its rings and holes clear in 10 to 40 seconds, some objects staying ghosted for a minute before they break free; at 3 the same takes 1.5 to 12 seconds and the estimate follows the morphing object closely.
// Knob 3: Support. How tightly the known support hugs the hidden parts, the margin beyond them being 2.2 grid cells (4.4 LEDs, the top square is drawn at two LEDs a cell) at -1, 4.1 cells (8 LEDs) at 0 where it opens, and 7.5 cells (15 LEDs) at +1. Tight, the silhouette is nearly given and the estimate is a clean ring, disc or bar; loose, the estimate has room for ghosts and a twin and grows into a textured field that fills most of the top square at +1.
// Knob 4: Parts. How many soft shapes the hidden object has, 1.8 at -1 (one ring and part of a bar, whose diffraction is a bull's-eye of rings), 4.8 at 0.06 where it opens, and 7.4 at +1; each shape fades in and out with the knob, so the Fourier plane gets finer and busier with every part added.

const W = 64, H = 128, N = 64, N2 = N * N;
const { floor, sqrt, exp, log, sin, cos, abs, min, max, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ---- random numbers --------------------------------------------------------
function ihash(n) {
  let h = (n | 0) + 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const hv = (i, key) => ihash(Math.imul(i, 73856093) ^ Math.imul(key, 19349663)) * 2 - 1;
// Smooth random walk, about -1..1: a new value at every whole step of t, joined by a Catmull-Rom curve.
function wander(t, key) {
  const i = floor(t), f = t - i;
  const a = hv(i - 1, key), b = hv(i, key), c = hv(i + 1, key), d = hv(i + 2, key);
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

// ---- the 64 by 64 complex FFT ---------------------------------------------
const REV = new Uint8Array(N);
for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < 6; b++) if (i & (1 << b)) r |= 1 << (5 - b); REV[i] = r; }
const WR = [], WI = [];
for (let len = 8; len <= N; len <<= 1) {
  const h = len >> 1, a = new Float64Array(h), b = new Float64Array(h);
  for (let j = 0; j < h; j++) { a[j] = cos((TAU * j) / len); b[j] = sin((TAU * j) / len); }
  WR.push(a); WI.push(b);
}
const XR = new Float64Array(N), XI = new Float64Array(N);

// One 64-point transform of re/im read at off, off + st, ..., sg = -1 forward, +1 inverse, not scaled.
function fft1(re, im, off, st, sg) {
  for (let i = 0; i < N; i += 4) {
    const j0 = off + REV[i] * st, j1 = off + REV[i + 1] * st, j2 = off + REV[i + 2] * st, j3 = off + REV[i + 3] * st;
    const ar = re[j0], ai = im[j0], br = re[j1], bi = im[j1], cr = re[j2], ci = im[j2], dr = re[j3], di = im[j3];
    const s0r = ar + br, s0i = ai + bi, d0r = ar - br, d0i = ai - bi;
    const s1r = cr + dr, s1i = ci + di, d1r = cr - dr, d1i = ci - di;
    XR[i] = s0r + s1r; XI[i] = s0i + s1i; XR[i + 2] = s0r - s1r; XI[i + 2] = s0i - s1i;
    const tr = -sg * d1i, ti = sg * d1r;
    XR[i + 1] = d0r + tr; XI[i + 1] = d0i + ti; XR[i + 3] = d0r - tr; XI[i + 3] = d0i - ti;
  }
  for (let len = 8, s = 0; len <= N; len <<= 1, s++) {
    const half = len >> 1, wr = WR[s], wi = WI[s];
    for (let i = 0; i < N; i += len)
      for (let j = 0; j < half; j++) {
        const a = i + j, b = a + half, c = wr[j], d = sg * wi[j];
        const vr = XR[b] * c - XI[b] * d, vi = XR[b] * d + XI[b] * c;
        XR[b] = XR[a] - vr; XI[b] = XI[a] - vi;
        XR[a] += vr; XI[a] += vi;
      }
  }
  for (let i = 0; i < N; i++) { const j = off + i * st; re[j] = XR[i]; im[j] = XI[i]; }
}
function fft2(re, im, sg) {
  for (let r = 0; r < N; r++) fft1(re, im, r * N, 1, sg);
  for (let c = 0; c < N; c++) fft1(re, im, c, N, sg);
}
function ifft2(re, im) {
  fft2(re, im, 1);
  for (let i = 0; i < N2; i++) { re[i] /= N2; im[i] /= N2; }
}

// ---- the hidden object ------------------------------------------------------
const SC = 0.75;       // size of the parts
const ZM = 2;          // LEDs per grid cell in the top square
const NP = 8;          // parts it can have
const EW = 2.4;        // LEDs, the soft edge of a part
const PRE = 30;        // iterations run before the first frame
const CAP = 3;         // no estimate pixel is ever longer than this

function newEpoch(P) {
  P.ep = (Math.random() * 1e6) | 0;
  const perm = [0, 1, 2];
  for (let i = 2; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  const R = (a, b) => a + (b - a) * Math.random();
  const S = () => (Math.random() < 0.5 ? -1 : 1);
  for (let i = 0; i < NP; i++) {
    P.ty[i] = perm[i % 3];
    P.ro[i] = i === 0 ? R(0, 2.5) : R(2.5, 9);
    P.th0[i] = R(0, TAU); P.thw[i] = S() * R(0.035, 0.13);
    P.sz[i] = P.ty[i] === 0 ? R(3.4, 5.4) : P.ty[i] === 1 ? R(5, 7.6) : R(5.2, 9.2);
    P.wd[i] = P.ty[i] === 1 ? R(2.4, 3.4) : R(1.7, 2.5);
    P.ph0[i] = R(0, TAU); P.phw[i] = S() * R(0.04, 0.17);
    P.cp0[i] = R(0, TAU); P.cpw[i] = S() * R(0.08, 0.3);
    P.am[i] = R(0.6, 1);
  }
}

function buildObject(P, parts, dil) {
  const { tr, ti, sd, pc } = P, t = P.t, ep = P.ep;
  tr.fill(0); ti.fill(0); sd.fill(99);
  // Every part's place and size at this moment; pc holds x, y, size, weight for each.
  let mx = 0, my = 0, mw = 0;
  for (let i = 0; i < NP; i++) {
    const w = smooth(cl(parts - i, 0, 1)), k = ep + i * 977, o = i * 4;
    pc[o + 3] = w;
    if (w < 0.002) continue;
    const th = P.th0[i] + P.thw[i] * t;
    const ro = SC * P.ro[i] * (0.8 + 0.25 * wander(t / 31 + i * 5.3, k + 11));
    const sz = SC * P.sz[i] * (1 + 0.2 * wander(t / 27 + i * 3.7, k + 12));
    pc[o] = ro * cos(th); pc[o + 1] = ro * sin(th); pc[o + 2] = sz;
    mx += w * sz * pc[o]; my += w * sz * pc[o + 1]; mw += w * sz;
  }
  // The group is held near the middle of the grid, with a slow drift of its own.
  const ox = 32 - 0.9 * mx / mw + SC * (2.2 * wander(t / 43 + 3.1, ep + 1) + 1.1 * wander(t / 19 + 7.7, ep + 2));
  const oy = 32 - 0.9 * my / mw + SC * (2.2 * wander(t / 47 + 1.3, ep + 3) + 1.1 * wander(t / 23 + 4.9, ep + 4));
  for (let i = 0; i < NP; i++) {
    const o = i * 4, w = pc[o + 3];
    if (w < 0.002) continue;
    const k = ep + i * 977;
    const cx = ox + pc[o], cy = oy + pc[o + 1], r = pc[o + 2];
    const ty = P.ty[i], wd = SC * P.wd[i];
    const ph = P.ph0[i] + P.phw[i] * t, cph = cos(ph), sph = sin(ph);
    const psi = P.cp0[i] + P.cpw[i] * t;
    const a = w * P.am[i] * (0.8 + 0.2 * wander(t / 21 + i * 2.9, k + 13));
    const ar = a * cos(psi), ai = a * sin(psi);
    const ext = (ty === 0 ? r : ty === 1 ? r + wd / 2 : r + wd) + dil + 3;
    const x0 = max(0, floor(cx - ext)), x1 = min(N - 1, floor(cx + ext) + 1);
    const y0 = max(0, floor(cy - ext)), y1 = min(N - 1, floor(cy + ext) + 1);
    const shrink = 14 * (1 - w);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x - cx, py = y - cy;
        let so, se;
        if (ty === 2) {
          const u = px * cph + py * sph, v = -px * sph + py * cph;
          const q = u - cl(u, -r, r), d = sqrt(q * q + v * v);
          so = d - wd; se = so - dil;
        } else {
          const d = sqrt(px * px + py * py);
          if (ty === 0) { so = d - r; se = so - dil; } else { so = abs(d - r) - wd / 2; se = d - (r + wd / 2 + dil); }
        }
        const j = y * N + x;
        se += shrink;
        if (se < sd[j]) sd[j] = se;
        const c = smooth(0.5 - so / EW);
        if (c > 0) { tr[j] += ar * c; ti[j] += ai * c; }
      }
  }
}

// ---- hybrid input-output ----------------------------------------------------
function noiseStart(P, gr = P.gr, gi = P.gi) {
  const { Gr, Gi, Mg } = P;
  for (let i = 0; i < N2; i++) { const p = Math.random() * TAU; Gr[i] = Mg[i] * cos(p); Gi[i] = Mg[i] * sin(p); }
  ifft2(Gr, Gi);
  for (let i = 0; i < N2; i++) { gr[i] = Gr[i]; gi[i] = Gi[i]; }
}

function hio(P, beta, n) {
  const { gr, gi, Gr, Gi, Mg, sup } = P;
  const cap2 = CAP * CAP;
  for (let it = 0; it < n; it++) {
    for (let i = 0; i < N2; i++) { Gr[i] = gr[i]; Gi[i] = gi[i]; }
    fft2(Gr, Gi, -1);
    for (let i = 0; i < N2; i++) {
      const m = sqrt(Gr[i] * Gr[i] + Gi[i] * Gi[i]);
      if (m > 1e-9) { const s = Mg[i] / m; Gr[i] *= s; Gi[i] *= s; } else { Gr[i] = Mg[i]; Gi[i] = 0; }
    }
    ifft2(Gr, Gi);
    for (let i = 0; i < N2; i++) {
      let r, q;
      if (sup[i]) { r = Gr[i]; q = Gi[i]; } else { r = gr[i] - beta * Gr[i]; q = gi[i] - beta * Gi[i]; }
      const a2 = r * r + q * q;
      if (a2 > cap2) { const s = CAP / sqrt(a2); r *= s; q *= s; }
      gr[i] = r; gi[i] = q;
    }
  }
}

// ---- state ------------------------------------------------------------------
export function setup(P) {
  P.ready = false;
  P.t = 0;
  const F = (n) => new Float64Array(n);
  P.gr = F(N2); P.gi = F(N2); P.Gr = F(N2); P.Gi = F(N2); P.Mg = F(N2);
  P.tr = F(N2); P.ti = F(N2); P.sd = F(N2); P.Er = F(N2); P.Ei = F(N2);
  P.Fr = F(N2); P.Fi = F(N2); P.Dr = F(N2); P.Di = F(N2); P.g0r = F(N2); P.g0i = F(N2);
  P.sup = new Uint8Array(N2);
  P.ty = new Int8Array(NP);
  P.pc = F(NP * 4);
  for (const k of ["ro", "th0", "thw", "sz", "wd", "ph0", "phw", "cp0", "cpw", "am"]) P[k] = F(NP);
  P.out = new Uint8ClampedArray(W * H * 3);
  P.acc = 0;
  P.melt = 0;
  P.zr = 1; P.zi = 0;
  P.mref = 100;
  P.iters = 0; P.epochs = 0;
  P.tReset = 50;
}

function measure(P, parts, dil) {
  buildObject(P, parts, dil);
  const { tr, ti, Fr, Fi, Mg, sd, sup } = P;
  for (let i = 0; i < N2; i++) { Fr[i] = tr[i]; Fi[i] = ti[i]; sup[i] = sd[i] <= 0 ? 1 : 0; }
  fft2(Fr, Fi, -1);
  let mx = 0;
  for (let i = 0; i < N2; i++) { const m = sqrt(Fr[i] * Fr[i] + Fi[i] * Fi[i]); Mg[i] = m; if (m > mx) mx = m; }
  P.mref += (mx - P.mref) * 0.1;
}

export function update(dt, input, P) {
  const kv = input.knobValues || [0, 2, 0, 0.06];
  const d = cl(dt, 0, 0.1);
  const hue = cl(kv[0], 0, 1), fb = cl(kv[1], 0.3, 3), supk = cl(kv[2], -1, 1), prtk = cl(kv[3], -1, 1);
  const beta = cl(0.12 + 0.34 * fb, 0.1, 1.2);
  const rate = 0.9 * exp((3.8 * (fb - 0.3)) / 2.7);
  const dil = 2.2 * Math.pow(3.4, (supk + 1) / 2);
  const parts = 4.6 + 2.8 * prtk;
  const first = !P.ready;
  if (!P.ready) {
    P.ready = true;
    P.tReset = 30 + -log(1 - Math.random()) * 55;
    newEpoch(P);
    measure(P, parts, dil);
    P.mref = max(...P.Mg);
    noiseStart(P);
    hio(P, beta, PRE);
    keepE(P);
  }
  P.t += d;
  P.tReset -= d;
  measure(P, parts, dil);
  if (P.tReset <= 0 && P.melt <= 0) {
    P.tReset = 40 + -log(1 - Math.random()) * 55;
    newEpoch(P);
    P.melt = 0.9;
    measure(P, parts, dil);
    noiseStart(P, P.g0r, P.g0i);
    P.epochs++;
  }
  if (P.melt > 0) {
    P.melt -= d;
    const k = 1 - exp(-d / 0.2), { gr, gi, g0r, g0i } = P;
    for (let i = 0; i < N2; i++) { gr[i] += (g0r[i] - gr[i]) * k; gi[i] += (g0i[i] - gi[i]) * k; }
    for (let i = 0; i < N2; i++) { P.Er[i] = gr[i]; P.Ei[i] = gi[i]; }
  } else {
    P.acc = min(P.acc + rate * d, 60);
    const n = floor(P.acc);
    P.acc -= n;
    if (n > 0) { hio(P, beta, n); keepE(P); P.iters += n; }
  }
  // a state that is not a number is thrown back to noise
  let ss = 0;
  for (let i = 0; i < N2; i += 7) ss += P.gr[i] * P.gr[i] + P.gi[i] * P.gi[i];
  if (!(ss < 1e9)) { noiseStart(P); keepE(P); }
  render(P, hue, d, rate, first);
}

function keepE(P) {
  const { Gr, Gi, Er, Ei } = P;
  for (let i = 0; i < N2; i++) { Er[i] = Gr[i]; Ei[i] = Gi[i]; }
}

// Phase colours: one table round the hue circle, 1024 steps, each channel 0..1. Cool colours take most of the
// circle and the warm stretch is short and bright, because a dim orange is brown on the panel.
const STOPS = [
  [0.0, 0, 214, 230], [0.15, 36, 130, 255], [0.3, 124, 80, 255], [0.44, 232, 60, 232],
  [0.57, 255, 66, 140], [0.65, 255, 118, 72], [0.72, 255, 200, 70], [0.8, 130, 236, 80], [0.9, 20, 222, 150], [1.0, 0, 214, 230],
];
const PL = new Float32Array(1024 * 3);
for (let i = 0; i < 1024; i++) {
  const f = i / 1024;
  let k = 0;
  while (STOPS[k + 1][0] < f) k++;
  const A = STOPS[k], B = STOPS[k + 1], u = (f - A[0]) / (B[0] - A[0]);
  for (let c = 0; c < 3; c++) PL[i * 3 + c] = (A[c + 1] + (B[c + 1] - A[c + 1]) * u) / 255;
}
// atan2 / 2 pi to about 0.0005 of a turn, -0.5..0.5
function turn(y, x) {
  const ax = abs(x), ay = abs(y), mx = max(ax, ay);
  if (mx < 1e-12) return 0;
  const a = min(ax, ay) / mx, s = a * a;
  let r = ((-0.0464964749 * s + 0.15931422) * s - 0.327622764) * s * a + a;
  if (ay > ax) r = 1.57079637 - r;
  if (x < 0) r = PI - r;
  if (y < 0) r = -r;
  return r / TAU;
}
const KNEE = 0.38, LOGSPAN = 2.5;

function render(P, hueK, dt, rate, first) {
  const { Er, Ei, Dr, Di, sup, sd, out, Fr, Fi, Mg } = P;
  const hueOff = 0.08 + hueK;
  // the sum of the estimate over the support sets its overall phase, kept steady in time
  let zr = 0, zi = 0;
  for (let i = 0; i < N2; i++) if (sup[i]) { zr += Er[i]; zi += Ei[i]; }
  const zm = sqrt(zr * zr + zi * zi);
  if (zm > 1e-6) { P.zr += (zr / zm - P.zr) * 0.12; P.zi += (zi / zm - P.zi) * 0.12; }
  const zn = sqrt(P.zr * P.zr + P.zi * P.zi) || 1;
  const ur = P.zr / zn, ui = P.zi / zn;
  // The picture follows the iterates through a short lag, so a slow iteration still moves smoothly.
  const kd = first ? 1 : 1 - exp(-dt / cl(1.1 / (rate + 0.5), 0.05, 0.4));
  for (let i = 0; i < N2; i++) {
    const nr = Er[i] * ur + Ei[i] * ui, ni = Ei[i] * ur - Er[i] * ui;
    Dr[i] += (nr - Dr[i]) * kd; Di[i] += (ni - Di[i]) * kd;
  }
  // Fourier plane of the estimate inside the support, origin in the middle
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x, s = ((x + y) & 1) ? -1 : 1;
      Fr[i] = sup[i] ? s * Dr[i] : 0; Fi[i] = sup[i] ? s * Di[i] : 0;
    }
  fft2(Fr, Fi, -1);
  const inv2 = 1 / (P.mref * P.mref);
  for (let y = 0; y < N; y++) {
    const gy = 32 + (y - 31.5) / ZM, y0 = clamp63(floor(gy)), y1 = min(63, y0 + 1), fy = smooth(cl(gy - y0, 0, 1));
    for (let x = 0; x < N; x++) {
      const gx = 32 + (x - 31.5) / ZM, x0 = clamp63(floor(gx)), x1 = min(63, x0 + 1), fx = smooth(cl(gx - x0, 0, 1));
      const i00 = y0 * N + x0, i01 = y0 * N + x1, i10 = y1 * N + x0, i11 = y1 * N + x1;
      const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
      const ar = Dr[i00] * w00 + Dr[i01] * w01 + Dr[i10] * w10 + Dr[i11] * w11;
      const ai = Di[i00] * w00 + Di[i01] * w01 + Di[i10] * w10 + Di[i11] * w11;
      const sdv = sd[i00] * w00 + sd[i01] * w01 + sd[i10] * w10 + sd[i11] * w11;
      const fi = smooth(0.5 - sdv / 1.5);
      const amp = sqrt(ar * ar + ai * ai) * (0.45 + 0.55 * fi);
      const v = (amp * (1 + KNEE)) / (amp + KNEE);
      const hc = (((turn(ai, ar) + hueOff) * 1024) & 1023) * 3;
      let o = (y * W + x) * 3;
      out[o] = 14 + 8 * fi + 241 * v * PL[hc];
      out[o + 1] = 18 + 9 * fi + 237 * v * PL[hc + 1];
      out[o + 2] = 52 + 18 * fi + 203 * v * PL[hc + 2];
      // bottom square: log size of the Fourier transform, hue its phase
      const i = y * N + x, sg = ((x + y) & 1) ? -1 : 1;
      const br = sg * Fr[i], bi = sg * Fi[i];
      const lv = Math.pow(cl((0.2171472 * Math.log((br * br + bi * bi) * inv2 + 1e-18) + LOGSPAN) / LOGSPAN, 0, 1), 1.1);
      const hb = (((turn(bi, br) + hueOff) * 1024) & 1023) * 3;
      o = ((y + N) * W + x) * 3;
      out[o] = 14 * (1 - lv) + 241 * lv * PL[hb];
      out[o + 1] = 18 * (1 - lv) + 237 * lv * PL[hb + 1];
      out[o + 2] = 52 * (1 - lv) + 203 * lv * PL[hb + 2];
    }
  }
}
const clamp63 = (v) => (v < 0 ? 0 : v > 63 ? 63 : v);

export function draw(display, P) {
  const { out } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
