// ===== Patternflow pattern =====
// Title:   Form Constants
// Family:  sim
// Idea:    A neural field with lateral inhibition and fatigue is solved on an unrolled visual cortex and drawn back onto the panel through the complex logarithm, so the stripes it makes on the cortex read as tunnels, funnels, spirals and cobwebs around a centre that wanders, running and turning for as long as it runs.
// Author:  patternflow-lab
// Date:    2026-11-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: neural field with lateral inhibition and fatigue (Hugh Wilson and Jack Cowan, 1972 and 1973; Shun-ichi Amari, 1977; from memory), geometric hallucinations as its pattern formation on the cortex (Bard Ermentrout and Jack Cowan, 1979; Paul Bressloff, Jack Cowan, Martin Golubitsky, Peter Thomas and Matthew Wiener, 2001; from memory), the complex logarithm as the map from retina to cortex (Eric Schwartz, 1980, from memory), the form constants (Heinrich Kluever, 1926, from memory), exponential time differencing (Steven Cox and Paul Matthews, 2002, from memory), colour in OKLab (Bjorn Ottosson, 2020, from memory), pattern round 127
// Round:   127
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Pace=1.5..3.5, Spokes=-1..1, Lattice=0..1
//
// Knob 1: Hue. Adds the knob times 360 degrees to the hue of the ramp, which at 0 runs from indigo through violet and rose to orange and a pale cream, so the panel opens on indigo and gold and a full turn comes back. The fatigue field b turns the hue a further 22 degrees either way, so the front of a running stripe is a little cooler than its back at every setting.
// Knob 2: Pace. A clock: the field runs 2.65 time units a second at Pace 2 (1.33 at Pace 1, 4.64 at 3.5), and a stripe's Hopf period is 10.6 units (2 pi over 0.59, the linear value near threshold), which is 8.0, 4.0 and 2.3 seconds at Pace 1, 2 and 3.5. The wandering of the centre, the turning of the stripes' preferred direction and the drift of the excitability patches all go with it.
// Knob 3: Spokes. k_c, the wavenumber the kernel likes best, which is also how many spokes a pure funnel has: 8 at the opening, 4.6 at -1 and 13.9 at 1 (8 times 1.732 to the knob). On the lattice of wavenumbers the cortex has (an integer n round the circle, a multiple of 2 along s) the pictures at the three settings grow in the modes (4,1), (8,0) and (7,6). Rings of a pure tunnel stand a factor exp(2 pi / k_s) apart in radius: 3.9, 2.2 and 1.6 at the three k_c.
// Knob 4: Lattice. The bias that tips stripes towards spots. The sigmoid f is tanh(u + beta) with tanh(beta) = p, its slope at rest held at the same value for every p, and p = 0.55 times the knob plus a slow swing of 0.2 (0.3 + that) + 0.12 either way, kept between 0 and 0.7. At p = 0 f is odd and the cortex makes stripes, which are tunnels, funnels and spirals; the quadratic term of f, -p times its slope, lets three stripes add up to a hexagonal lattice, which is a cobweb round the centre. At the opening the swing alone takes p up to 0.2 now and then.

// What the field is. On the cortex plane (theta round the circle in 128 cells, s along the radius in 64 cells of the same size, both periodic, so s
// has a length of pi and theta of 2 pi) the activity a and the fatigue b obey
//   a_t = -a + w * f(a - b + noise)                    w a difference of two gaussians, the inhibition twice as wide and of the same area,
//   b_t = (C a - b) / tau                               scaled so that its Fourier transform is 1 at its peak k_c and zero at k = 0.
// Linearised about a = b = 0 a mode of wavenumber k has the matrix [[-1 + g w(k), -g w(k)], [C / tau, -1 / tau]], where g is the slope of f at
// rest. Its trace is -1 - 1 / tau + g w and its determinant (1 - g w + C g w) / tau. The trace crosses zero, with a determinant that is still
// positive, at g w = 1 + 1 / tau: an oscillation (a Hopf bifurcation), of frequency sqrt(det) = sqrt((C (1 + 1 / tau) - 1 / tau) / tau). The
// stationary (Turing) threshold g w = 1 / (1 - C) is further off (C = 0.8, tau = 2: 5 against 1.5), so the fatigue makes the first stripes
// run, and the field never settles to a standing pattern by itself. With w = 1 at k_c, g_H = 1 + 1 / tau = 1.5 is the threshold gain
// and the field runs at g = g_H (1 + eps), eps = 0.25 at the opening, so the stripes are 25 percent over it.
// Each step is exact in the linear part. The 2 by 2 exponential of L dt and its integral are summed from a Taylor series (ten terms) for
// every |k| class, once for each k_c; what is left of f, G tanh(u + beta) - G p - g_0 u, is held over the step (exponential time differencing
// of the first order), so the threshold, the frequency and the decay rate of a mode come out as theory at any step. The state stays in the
// Fourier domain. One inverse transform per step gives u = a - b and a in a single complex transform (u in the real part, a in the
// imaginary part), one forward transform takes the nonlinear remainder back. The step is 0.12 of a time unit; the field is the blend of two
// steps, so that Pace moves it smoothly. 128 by 64 cells, about 0.9 ms a frame in node.
// The picture. A point of the panel at (dx, dy) from the centre of the map is at theta = atan2(dy, dx) and s = ln(sqrt(r^2 + R0^2) / R0),
// R0 = 4 LEDs: the complex logarithm of Schwartz's map, rounded off inside R0 so that the centre has a value. The cortex is read bilinearly
// there, and an LED within 24 of the centre, where it covers several cells, is the average over a grid of up to 8 by 8 points inside it, so
// the spokes that the panel cannot resolve near the centre average away and no aliasing is left (a point at 5 LEDs of an 8-spoke funnel
// has spokes 4 LEDs apart). The panel's corners are 71 LEDs out from the middle, s = 2.9 of the 3.14 the cortex has, and when the centre
// has wandered the far corner reaches s = 3.19 and wraps to the first rows of the cortex, which is the same cortex. The activity a, over its rms (smoothed over 1.5 s), goes through
// tanh and picks the step of the ramp; b over its rms turns the hue.
// What keeps it alive. A field at 25 percent over threshold settles into a limit cycle of period 4 s that is the same every cycle, and
// frames 20 seconds apart match (recur 0.05 and quiet 0.11 in the first version). Three slow things take that away, each of them an input
// to the field and none of them a drawing of stripes. (1) The gain depends on the direction of the wave vector, g (1 + 0.15 cos 2 (phi - psi)),
// phi the direction of k in the (theta, s) plane and psi turning at 0.0105 a time unit plus a swing of 0.9 radian at 0.00565, which is a
// cortex whose lateral connections lean one way, and the stripes lean with them: spokes at psi = 0, rings at psi = pi / 2, spirals between.
// It is put in as a term of the same size as the nonlinear remainder, held over the step. (2) Patches of excitability: the local eps is
// multiplied by 1 + 0.34 cos(theta + 2 s + ...) + 0.30 cos(2 theta - 2 s + ...) + 0.26 cos(3 theta + ...), each drifting at about 0.01 of
// a time unit and swelling and fading at about 0.005, never below a quarter, so there is always somewhere stripes grow and somewhere
// they barely do. This is what lifted recur from 0.3 to 0.45. (3) The centre of the map wanders, 11 LEDs either way in x and 22 in
// y, at up to 4 LEDs a second, on two incommensurate sines each. The stripes near the centre are finer than a 16 by 16 block, and a block
// there changes only when an arm sweeps across it, so the four central blocks changed a tenth to a third as much as the outer ones. The
// wandering took quiet from 0.11 to 0.23 and the patches on to 0.31 to 0.35 (three seeds). Noise, 0.03 per root time unit, goes in before the kernel, so it is filtered to the band that grows. The gain
// eps and the bias p swing slowly on sines of 0.073, 0.032, 0.052 and 0.021 radians a unit, none of them dividing another.
// Why not faster. Turning psi, and the patches, twice as fast lowered recur to 0.30 and 0.34 (three seeds each); as they were it was
// 0.41, and half as fast 0.43 to 0.49: the same orientations came round twice as often in 240 s, and the nearest pair of frames a
// little over 20 seconds apart got closer. The wandering of the centre went the other way: a faster one gave quiet more and recur less.

const { floor, ceil, sqrt, sin, cos, exp, log, abs, min, max, PI, pow, atan2, tanh } = Math;
const W = 64, H = 128, N = W * H;
const NT = 128, NS = 64, NC = NT * NS; // cortex: theta (periodic, 128 cells) by s (periodic, 64 cells)
const TAU = 2 * PI;
const HC = TAU / NT;                   // one cell, in radians of theta and in units of s
const LS = NS * HC;                    // length of the s axis (pi)
const KS = TAU / LS;                   // spacing of the wavenumbers along s (2)
const R0 = 4;                          // core radius of the map, LEDs
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- model constants. Time is in units of the activity's decay time.
const TAU_B = 2;                   // fatigue time
const C_FAT = 0.8;                 // fatigue drive: db/dt = (C a - b) / TAU_B
const G_H = 1 + 1 / TAU_B;         // gain at which the mode at the kernel's peak starts to oscillate (kernel peak normalised to 1)
const EPS0 = 0.25;                 // how far above it the field runs, on average
const ANISO = 0.15;                // how much the gain depends on the direction of the wave vector, at most
const RHO2 = 4;                    // (sigma_inhibition / sigma_excitation) squared
const DT = 0.12;                   // step
const RATE0 = 2.65;                // time units a second at Pace 2
const NOISE = 0.16;
const VIG = 0.65;                  // how far the contrast has fallen at the far corners
// slow patches of excitability: the gain is multiplied by 1 + sum A cos(n theta + KS m s + nu t + phi), at low wavenumbers
const PATCH = [
  // n, m, amplitude, nu, phi, amplitude modulation rate
  [1, 1, 0.51, 0.0146, 0.4, 0.0069],
  [2, -1, 0.45, -0.0087, 2.1, 0.0045],
  [3, 0, 0.39, 0.0124, 4.0, 0.0057],
];

function fftTables(n) {
  const c = new Float64Array(n / 2), s = new Float64Array(n / 2), rev = new Uint16Array(n);
  for (let k = 0; k < n / 2; k++) { c[k] = cos((TAU * k) / n); s[k] = sin((TAU * k) / n); }
  let bits = 0;
  while (1 << bits < n) bits++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  return { n, c, s, rev };
}
const FT = fftTables(NT), FS = fftTables(NS);

// in-place radix-2 transform of n values at re[off..], im[off..]; sg = -1 forward, +1 inverse (neither scaled)
function fft1(re, im, off, T, sg) {
  const n = T.n, rev = T.rev, tc = T.c, ts = T.s;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[off + i]; re[off + i] = re[off + j]; re[off + j] = t;
      t = im[off + i]; im[off + i] = im[off + j]; im[off + j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0, w = 0; k < half; k++, w += step) {
        const wr = tc[w], wi = sg * ts[w];
        const a = off + i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}
const CR = new Float64Array(NS), CI = new Float64Array(NS);
function fft2(re, im, sg) {
  for (let j = 0; j < NS; j++) fft1(re, im, j * NT, FT, sg);
  for (let i = 0; i < NT; i++) {
    for (let j = 0; j < NS; j++) { CR[j] = re[j * NT + i]; CI[j] = im[j * NT + i]; }
    fft1(CR, CI, 0, FS, sg);
    for (let j = 0; j < NS; j++) { re[j * NT + i] = CR[j]; im[j * NT + i] = CI[j]; }
  }
}

// tanh by table
const TN = 4096, TR = 8;
const TT = new Float32Array(TN + 2);
for (let i = 0; i <= TN + 1; i++) TT[i] = tanh(((i / TN) * 2 - 1) * TR);
function tnh(x) {
  const q = (x + TR) * (TN / (2 * TR));
  if (q <= 0) return -1;
  if (q >= TN) return 1;
  const i = q | 0, f = q - i;
  return TT[i] + (TT[i + 1] - TT[i]) * f;
}

function newState() {
  return {
    ar: new Float64Array(NC), ai: new Float64Array(NC), br: new Float64Array(NC), bi: new Float64Array(NC),
    zr: new Float64Array(NC), zi: new Float64Array(NC), rr: new Float64Array(NC), ri: new Float64Array(NC),
    ap: new Float32Array(NC), ac: new Float32Array(NC), tmp: new Float32Array(NC),
    bp: new Float32Array(NC), bc: new Float32Array(NC), tmb: new Float32Array(NC), rmsb: 0.3,
    cls: new Uint16Array(NC), conj: new Int32Array(NC),
    e11: new Float64Array(33 * 65), e12: new Float64Array(33 * 65), e21: new Float64Array(33 * 65), e22: new Float64Array(33 * 65),
    pa: new Float64Array(33 * 65), pb: new Float64Array(33 * 65), wk: new Float64Array(33 * 65),
    kc: 8, kcDone: -1, acc: 0, t: 0, t2: 0, steps: 0, rms: 0.5, pace: 2,
    lut: new Uint8Array(3 * NA * NB), hueDone: -999, lattice: 0,
    cx: 32, cy: 64, cs2: new Float64Array(NC), sn2: new Float64Array(NC),
    q1: new Float64Array(33 * 65), q2: new Float64Array(33 * 65), psi: 0, ani: 0,
    pc: PATCH.map(() => new Float32Array(NC)), ps: PATCH.map(() => new Float32Array(NC)), loc: new Float32Array(NC),
  };
}

function initIndex(S) {
  for (let j = 0; j < NS; j++)
    for (let i = 0; i < NT; i++) {
      const m = j < NS / 2 ? j : j - NS, n = i < NT / 2 ? i : i - NT;
      S.cls[j * NT + i] = abs(m) * 65 + abs(n);
      S.conj[j * NT + i] = ((NS - j) % NS) * NT + ((NT - i) % NT);
      // direction of the wave vector in the (theta, s) plane, as cos 2phi and sin 2phi
      const ks = KS * m, k2 = n * n + ks * ks;
      S.cs2[j * NT + i] = k2 > 0 ? (n * n - ks * ks) / k2 : 0;
      S.sn2[j * NT + i] = k2 > 0 ? (2 * n * ks) / k2 : 0;
      PATCH.forEach((q, a) => {
        const ph = q[0] * i * HC + KS * q[1] * j * HC;
        S.pc[a][j * NT + i] = cos(ph);
        S.ps[a][j * NT + i] = sin(ph);
      });
    }
}

// Kernel: difference of two gaussians, sigma_i = 2 sigma_e, area balanced; Fourier transform normalised to 1 at its peak kc.
function buildSpectrum(S, kc) {
  const xpk = (2 * log(RHO2)) / (RHO2 - 1);
  const wpk = exp(-xpk / 2) - exp((-xpk * RHO2) / 2);
  const sig2 = xpk / (kc * kc);
  const g0 = G_H * (1 + EPS0);
  for (let am = 0; am <= 32; am++)
    for (let an = 0; an <= 64; an++) {
      const k2 = an * an + KS * am * (KS * am), x = sig2 * k2;
      const w = (exp(-x / 2) - exp((-x * RHO2) / 2)) / wpk;
      const c = am * 65 + an;
      S.wk[c] = w;
      const g = g0 * w;
      // M = L dt, L = [[-1 + g, -g], [C / tau, -1 / tau]]
      const m11 = (-1 + g) * DT, m12 = -g * DT, m21 = (C_FAT / TAU_B) * DT, m22 = (-1 / TAU_B) * DT;
      let e11 = 1, e12 = 0, e21 = 0, e22 = 1; // sum of M^k / k!
      let p11 = 1, p21 = 0;                  // sum of M^k / (k+1)! first column
      let t11 = 1, t12 = 0, t21 = 0, t22 = 1; // M^k
      let f = 1;
      for (let k = 1; k <= 10; k++) {
        const n11 = t11 * m11 + t12 * m21, n12 = t11 * m12 + t12 * m22, n21 = t21 * m11 + t22 * m21, n22 = t21 * m12 + t22 * m22;
        t11 = n11; t12 = n12; t21 = n21; t22 = n22;
        f *= k;
        e11 += t11 / f; e12 += t12 / f; e21 += t21 / f; e22 += t22 / f;
        p11 += t11 / (f * (k + 1)); p21 += t21 / (f * (k + 1));
      }
      S.e11[c] = e11; S.e12[c] = e12; S.e21[c] = e21; S.e22[c] = e22;
      S.pa[c] = (DT * p11 * w) / NC;
      S.pb[c] = (DT * p21 * w) / NC;
      S.q1[c] = DT * p11;
      S.q2[c] = DT * p21;
    }
  S.kcDone = kc;
}

function gauss() {
  return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.7320508;
}

// one step of the field: u = a - b by the inverse transform, the nonlinearity, the forward transform, the exponential update
function step(S) {
  const { ar, ai, br, bi, zr, zi, rr, ri, cls, e11, e12, e21, e22, pa, pb } = S;
  for (let i = 0; i < NC; i++) {
    zr[i] = ar[i] - br[i] - ai[i];
    zi[i] = ai[i] - bi[i] + ar[i];
  }
  fft2(zr, zi, 1); // real part u = a - b, imaginary part a
  const t = S.t2; // the slow things run on their own clock, which does not follow Pace
  const eps = EPS0 * (1 + 0.25 * sin(0.0731 * t + 1.1) + 0.15 * sin(0.0317 * t + 0.4));
  // gain that depends on the direction of the wave vector, turning slowly: the stripes lean towards psi
  const psi = 0.0105 * t + 0.9 * sin(0.00565 * t + 0.5), ani = ANISO * (0.7 + 0.3 * sin(0.0173 * t + 2.1));
  const c2 = cos(2 * psi), s2 = sin(2 * psi), ag = G_H * (1 + EPS0) * ani;
  S.psi = psi;
  const pb0 = S.lattice;
  const p = cl(pb0 + 0.2 * sin(0.0523 * t + 2.3) * (0.3 + pb0) + 0.12 * sin(0.0211 * t), 0, 0.7);
  const beta = 0.5 * log((1 + p) / (1 - p));
  const Gb = G_H / (1 - p * p), g0 = G_H * (1 + EPS0);
  const sn = NOISE / sqrt(DT);
  const loc = S.loc;
  loc.fill(1);
  PATCH.forEach((q, a) => {
    const am = q[2] * (0.65 + 0.35 * sin(q[5] * t + 1.7 * a)), ph = q[3] * t + q[4], cc = am * cos(ph), ss = am * sin(ph);
    const pc = S.pc[a], ps = S.ps[a];
    for (let i = 0; i < NC; i++) loc[i] += pc[i] * cc - ps[i] * ss;
  });
  const ac = S.ap, bcur = S.bp; // reuse: the old previous becomes the new current
  S.ap = S.ac;
  S.ac = ac;
  S.bp = S.bc;
  S.bc = bcur;
  for (let i = 0; i < NC; i++) {
    const u = zr[i];
    ac[i] = zi[i];
    bcur[i] = zi[i] - u;
    rr[i] = Gb * (1 + eps * (loc[i] < 0 ? 0 : loc[i])) * (tnh(u + beta) - p) - g0 * u + sn * gauss();
    ri[i] = 0;
  }
  fft2(rr, ri, -1);
  const { q1, q2, wk, cs2, sn2 } = S;
  for (let i = 0; i < NC; i++) {
    const c = cls[i], xr = ar[i], xi = ai[i], yr = br[i], yi = bi[i];
    // the part of the coupling that the direction adds: ag w(k) cos 2(phi - psi) (a - b)
    const ex = ag * wk[c] * (cs2[i] * c2 + sn2[i] * s2);
    const Ri = ri[i];
    const fr = pa[c] * rr[i] + q1[c] * ex * (xr - yr), fi = pa[c] * Ri + q1[c] * ex * (xi - yi);
    const gr = pb[c] * rr[i] + q2[c] * ex * (xr - yr), gi = pb[c] * Ri + q2[c] * ex * (xi - yi);
    ar[i] = e11[c] * xr + e12[c] * yr + fr;
    ai[i] = e11[c] * xi + e12[c] * yi + fi;
    br[i] = e21[c] * xr + e22[c] * yr + gr;
    bi[i] = e21[c] * xi + e22[c] * yi + gi;
  }
  S.t += DT;
  S.t2 += (DT * 2) / S.pace;
  S.steps++;
  if (S.steps % 25 === 0) {
    const cj = S.conj;
    for (let i = 0; i < NC; i++) {
      const j = cj[i];
      if (j < i) continue;
      const mr = 0.5 * (ar[i] + ar[j]), mi = 0.5 * (ai[i] - ai[j]);
      ar[i] = ar[j] = mr; ai[i] = mi; ai[j] = -mi;
      const nr = 0.5 * (br[i] + br[j]), ni = 0.5 * (bi[i] - bi[j]);
      br[i] = br[j] = nr; bi[i] = ni; bi[j] = -ni;
    }
  }
}

// ---- retina to cortex. A point at (dx, dy) from the centre is at s = ln(sqrt(r^2 + R0^2) / R0), theta = atan2(dy, dx):
// the complex logarithm, rounded off inside R0 so that the centre has a value. The cortex is read bilinearly, and an LED near the
// centre, where it covers several cells, is the average of a grid of points across its area.
const IR02 = 1 / (R0 * R0), CELLS = NT / TAU;
let VA = 0, VB = 0;
// atan2 from a polynomial in min / max, good to 1e-5 radian, in 0..2 pi
function angle(y, x) {
  const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y;
  const hi = ax > ay ? ax : ay, lo = ax > ay ? ay : ax;
  if (hi === 0) return 0;
  const a = lo / hi, q = a * a;
  let r = (((-0.0464964749 * q + 0.15931422) * q - 0.327622764) * q * a) + a;
  if (ay > ax) r = 1.57079637 - r;
  if (x < 0) r = 3.14159274 - r;
  return y < 0 ? TAU - r : r;
}
function cortexAt(fa, fb, dx, dy) {
  const s = 0.5 * log((dx * dx + dy * dy) * IR02 + 1);
  const th = angle(dy, dx);
  const fi = th * CELLS, fj = s / HC;
  const i0 = fi | 0, j0 = fj | 0, ax = fi - i0, ay = fj - j0;
  const i1 = i0 + 1 === NT ? 0 : i0 + 1, j1 = j0 + 1 >= NS ? j0 + 1 - NS : j0 + 1, jj0 = j0 >= NS ? j0 - NS : j0;
  const r0 = jj0 * NT, r1 = j1 * NT;
  const w00 = (1 - ax) * (1 - ay), w01 = ax * (1 - ay), w10 = (1 - ax) * ay, w11 = ax * ay;
  VA = fa[r0 + i0] * w00 + fa[r0 + i1] * w01 + fa[r1 + i0] * w10 + fa[r1 + i1] * w11;
  VB = fb[r0 + i0] * w00 + fb[r0 + i1] * w01 + fb[r1 + i0] * w10 + fb[r1 + i1] * w11;
}

// ---- colour
function lin(L, a, b, o) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  o[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  o[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  o[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}
const GAM = new Float32Array(4097);
for (let k = 0; k <= 4096; k++) {
  const x = k / 4096;
  GAM[k] = 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055);
}
const gam = (x) => GAM[x <= 0 ? 0 : x >= 1 ? 4096 : (x * 4096 + 0.5) | 0];
const STOPS = [
  [0.0, 0.2, 0.12, 275],
  [0.25, 0.36, 0.2, 290],
  [0.5, 0.52, 0.2, 355],
  [0.75, 0.74, 0.17, 55],
  [0.92, 0.9, 0.15, 95],
  [1.0, 0.97, 0.05, 100],
];
const TMP = [0, 0, 0];
// 2D table: activity a picks the step of the ramp, fatigue b turns the hue by up to HB degrees either way
const NA = 160, NB = 17, HB = 22;
function buildLut(S, shift) {
  const lut = S.lut;
  for (let qa = 0; qa < NA; qa++) {
    const t = qa / (NA - 1);
    let n = 1;
    while (n < STOPS.length - 1 && STOPS[n][0] < t) n++;
    const A = STOPS[n - 1], B = STOPS[n], u = (t - A[0]) / (B[0] - A[0]), w = u * u * (3 - 2 * u);
    const L = A[1] + (B[1] - A[1]) * w;
    const C0 = A[2] + (B[2] - A[2]) * w;
    let dh = B[3] - A[3];
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    for (let qb = 0; qb < NB; qb++) {
      const h = ((A[3] + dh * w + shift + HB * ((2 * qb) / (NB - 1) - 1)) * PI) / 180;
      let C = C0;
      for (let it = 0; it < 8; it++) {
        lin(L, C * cos(h), C * sin(h), TMP);
        if (TMP[0] >= -0.002 && TMP[1] >= -0.002 && TMP[2] >= -0.002 && TMP[0] <= 1.002 && TMP[1] <= 1.002 && TMP[2] <= 1.002) break;
        C *= 0.9;
      }
      lin(L, C * cos(h), C * sin(h), TMP);
      const o = 3 * (qa * NB + qb);
      lut[o] = gam(TMP[0]);
      lut[o + 1] = gam(TMP[1]);
      lut[o + 2] = gam(TMP[2]);
    }
  }
  S.hueDone = shift;
}

const KNOB = [0, 2, 0, 0.06];
function targets(k) {
  return {
    pace: cl(k[1], 1.5, 3.5) / 2,
    kc: 9 * pow(1.5, cl(k[2], -1, 1)),
    lattice: 0.55 * cl(k[3], 0, 1),
  };
}

export function setup(params, knobValues) {
  const S = (params.s = newState());
  const tg = targets(knobValues || KNOB);
  S.pace = tg.pace;
  S.kc = tg.kc;
  S.lattice = tg.lattice;
  initIndex(S);
  buildSpectrum(S, S.kc);
  buildLut(S, 0);
  // a small band-limited seed
  for (let i = 0; i < NC; i++) { S.rr[i] = 0.3 * gauss(); S.ri[i] = 0; }
  fft2(S.rr, S.ri, -1);
  for (let i = 0; i < NC; i++) {
    const c = S.cls[i];
    S.ar[i] = (S.rr[i] * S.wk[c]) / NC;
    S.ai[i] = (S.ri[i] * S.wk[c]) / NC;
  }
  for (let i = 0; i < 320; i++) step(S);
  S.rms = 0.5;
}

export function update(dt, input, params) {
  const k = input.knobValues || KNOB;
  if (!params.s) setup(params, k);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const hue = cl(k[0], 0, 1) * 360 + 30 * sin(0.0211 * S.t2 + 1) + 18 * sin(0.0463 * S.t2 + 2.4);
  if (abs(hue - S.hueDone) > 1.5) buildLut(S, hue);
  if (d <= 0) return;
  const tg = targets(k), f = 1 - exp(-4 * d);
  S.pace += (tg.pace - S.pace) * f;
  S.lattice += (tg.lattice - S.lattice) * f;
  S.kc += (tg.kc - S.kc) * f;
  if (abs(S.kc - S.kcDone) > 0.004 * S.kc) buildSpectrum(S, S.kc);
  S.acc += d * RATE0 * S.pace;
  let guard = 0;
  while (S.acc >= DT && guard++ < 8) {
    step(S);
    S.acc -= DT;
  }
  const al = S.acc / DT, ap = S.ap, ac = S.ac, tmp = S.tmp, bp = S.bp, bc = S.bc, tmb = S.tmb;
  let ss = 0, sb = 0;
  for (let i = 0; i < NC; i++) {
    const v = ap[i] + (ac[i] - ap[i]) * al, w = bp[i] + (bc[i] - bp[i]) * al;
    tmp[i] = v;
    tmb[i] = w;
    ss += v * v;
    sb += w * w;
  }
  const r = sqrt(ss / NC);
  if (!(r < 1e6)) { setup(params, k); return; }
  S.rms += (r - S.rms) * (1 - exp(-d / 1.5));
  S.rmsb += (sqrt(sb / NC) - S.rmsb) * (1 - exp(-d / 1.5));
  // the centre of the map wanders, like where the eye rests
  const t = S.t2 + (al * DT * 2) / S.pace;
  S.cx = 32 + 8 * sin(0.069 * t + 0.7) + 3.2 * sin(0.163 * t + 2);
  S.cy = 64 + 16 * sin(0.053 * t + 1.3) + 6.5 * sin(0.126 * t);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const lut = S.lut, tmp = S.tmp, tmb = S.tmb, cx = S.cx, cy = S.cy;
  const g = 0.9 / max(1e-6, S.rms), gb = 1.2 / max(1e-6, S.rmsb);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r2 = dx * dx + dy * dy;
      let v, vb;
      if (r2 > 400) {
        cortexAt(tmp, tmb, dx, dy);
        v = VA;
        vb = VB;
      } else {
        const r = max(0.7, sqrt(r2));
        const ns = cl(ceil(0.6 * max(1 / (r * HC), r / ((r * r + R0 * R0) * HC))), 1, 8);
        v = 0;
        vb = 0;
        for (let sy = 0; sy < ns; sy++)
          for (let sx = 0; sx < ns; sx++) {
            cortexAt(tmp, tmb, x + (sx + 0.5) / ns - cx, y + (sy + 0.5) / ns - cy);
            v += VA;
            vb += VB;
          }
        v /= ns * ns;
        vb /= ns * ns;
      }
      // contrast falls towards the far corners, as acuity falls with eccentricity: 1 inside 20 LEDs, 1 - VIG at 70
      const tv = r2 < 400 ? 0 : r2 > 4900 ? 1 : (r2 - 400) / 4500, cv = 1 - VIG * tv * tv * (3 - 2 * tv);
      const qa = (0.5 + 0.5 * tnh(v * g * cv)) * (NA - 1), qb = (0.5 + 0.5 * tnh(vb * gb * cv)) * (NB - 1);
      const ia = (qa + 0.5) | 0, ib = qb | 0, fb = qb - ib, o = 3 * (ia * NB + ib), o2 = ib + 1 < NB ? o + 3 : o;
      display.setPixel(x, y, lut[o] + (lut[o2] - lut[o]) * fb, lut[o + 1] + (lut[o2 + 1] - lut[o + 1]) * fb, lut[o + 2] + (lut[o2 + 2] - lut[o + 2]) * fb);
    }
}
