// ===== Patternflow pattern =====
// Title:   Mesoscale Turbulence
// Family:  sim
// Idea:    The incompressible Toner-Tu-Swift-Hohenberg equation of a dense bacterial suspension runs on the panel's own 64 by 128 torus and the picture is its velocity, one ring of colour for the direction the water heads, so that every vortex is a pinwheel with a dark eye, neighbours turn opposite ways and are drawn one light and one deep, and the crowd of them never stops tearing and re-knitting.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: mesoscale turbulence of dense swimming bacteria (Henricus Wensink, Joern Dunkel, Sebastian Heidenreich, Knut Drescher, Raymond Goldstein, Hartmut Loewen and Julia Yeomans, PNAS 2012; Joern Dunkel, Sebastian Heidenreich, Knut Drescher, Henricus Wensink, Markus Baer and Raymond Goldstein, Phys. Rev. Lett. 2013, the continuum model; author lists from memory and possibly wrong), the incompressible Toner-Tu equation with a fourth-order Swift-Hohenberg viscosity (John Toner and Yuhai Tu, 1995; Jack Swift and Pierre Hohenberg, 1977), solved with Fourier modes and an integrating-factor Runge-Kutta 4 step (Lawson 1967), colours in Oklab (Bjorn Ottosson, 2020); every name and year here is from memory; pattern round 123
// Round:   123
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..5, Scale=-1..1, Activity=-1..1
//
// Knob 1: Hue. Turns the ring of heading colours by the knob times 360 degrees, one turn comes back. At 0 water heading right is steel blue (74, 125, 173), down orchid (144, 91, 165), left apricot (211, 146, 103) and up mint (132, 204, 165); at 0.25 each colour has moved one heading round (right is orchid), at 0.5 right is apricot, at 0.75 mint. The ring is eight knots in Oklab joined by a cubic, drawn at 0.6 of their chroma so that the panel's 1.62 saturation boost does not make neon of it; its Rec. 601 luma at full speed is 89 to 190, mean 143. Water at rest loses up to 0.34 of Oklab lightness, and a vortex turning one way is up to 0.2 lighter and one turning the other up to 0.2 deeper.
// Knob 2: Flow. The clock, 0.12 model time units per panel second per unit of the knob: 0.06 at 0.5, 0.24 at the opening 2, 0.6 at 5. The velocity field's correlation with itself falls to 1/e after 2.24 model time units at the opening Scale and Activity, which is 37 s at Flow 0.5, 9.3 s at 2 and 3.7 s at 5. The water moves at 0.87 model lengths per model time unit rms, which at the opening Scale (0.449 model lengths to an LED) is 0.12, 0.46 and 1.16 LEDs a second at the three.
// Knob 3: Scale. The size of one LED in model length, dx = 2 pi / L, with L the number of LEDs that one model length 2 pi covers: 14 at 0, 14 times 1.55 to the knob below it (9.0 at -1) and 14 times 1.25 to the knob above it (17.5 at 1). Counted as extrema of the stream function above 0.3 of its rms, at Activity 0.06 the panel holds 68.8, 28.6 and 17.8 vortices at -1, 0 and 1, one to every 10.9, 16.9 and 21.5 LEDs of spacing (3.8 across the 64 LEDs at the opening); with Activity at -1 and 1 as well the ends are 72 and 15 vortices, 10.6 and 23 LEDs. Below L 9 the 16 modes along x end at wavenumber 2.3 and under L 6 the field is grid noise (241 extrema), so the knob stops there.
// Knob 4: Activity. alpha = -0.62 times 1.6 to the knob: -0.39 at -1, -0.64 at the opening 0.06, -0.99 at 1, the rate at which the water wants to move. The saturated speed sqrt(-alpha / beta) is 0.62, 0.80 and 1.0; the rms speed measured over 150 model time units at Scale 0 is 0.78, 0.87 and 0.99. Low, the vortices are soft cells and the speed varies from point to point; high, the speed is nearly the same everywhere and straight rays run out of each pinwheel's eye. Vortex counts at Scale 0: 32.4, 28.6 and 23.9. Past -1.3 four giant pinwheels fill the panel and nothing moves, so the knob stops at -0.99.

// What the field is. A torus of 64 by 128 cells, one to an LED, and the velocity v, whose stream function psi (u = psi_y, w = -psi_x, vorticity -lap psi) is the state, in model units where the fastest wavenumber is 1:
//   v_t + lam (v.grad) v = -(alpha + beta |v|^2) v - grad p - Gamma0 lap v - Gamma2 lap^2 v,   div v = 0
// with Gamma0 = -2 (negative viscosity: a band of scales is driven), Gamma2 = 1, beta = 1, lam = 8. Mode k grows at sigma(k) = -alpha + 2 k^2 - k^4, fastest at k = 1 where it is 1.64 at the opening, and the band of growing modes runs from 0 to 1.51. The pressure goes with the curl: psi_t = L psi + (1 / k^2) [ -lam v.grad omega - beta curl(|v|^2 v) ]. Two terms are mine: a drag mu exp(-k^2 / 0.16), mu = 0.5, on the largest scales, and a weak noise on modes below k 1.3, 0.01 per square root of model time. The mean flow is held at zero.
// Numerics: 1596 modes in the disc m^2 + (n / 2)^2 <= 16^2 (m along x, n along y), which is the one-quarter rule: a product of three modes cannot reach back into the disc on a 64 wide grid, so the cubic term has no aliasing. Integrating-factor Runge-Kutta 4 with the step cut so that lam v_max 2 h <= 1.5, at most 0.06, which is one step a frame at every Flow. Four inverse and three forward real transforms per evaluation, written here, radix 2, two real rows to one complex transform. A mode and its mirror are made conjugates again after every step. Before the first frame 12 model time units run from random modes at the saturated speed.
//
// What was checked, with this file's own functions and scripts of mine, not in the repo:
// - Growth of single modes at amplitude 1e-9 against sigma(k): eleven modes at three Activities agree to 1.1e-12 (the linear part is exact in this scheme, so this checks the indexing and L).
// - The cubic term: a shear roll u(y) saturates where the cubic balances the growth. The solver's fundamental after 10 model time units against a separate 1-D program (harmonics 1 to 15, the cube formed on 256 points, RK4 at 1e-3): 0.67892 against 0.67935, 1.35045 against 1.35042, 0.73069 against 0.73069. The textbook sqrt(4 sigma / 3 beta) is not met (1.03 for the first) because the third harmonic of the roll takes a share.
// - Step: the same spun-up state taken 3 model time units at h 0.1, 0.05, 0.025, 0.0125, 0.00625: relative error of psi 1.7e-3, 1.8e-4, 1.6e-5, 1.3e-6, 8.4e-8, ratios 9.6, 10.9, 12.9, 15.1, towards the 16 of a fourth order scheme (measured before the drag was added; the drag is linear).
// - Truncation: the same state on 128 by 256 with 24 modes (same box, wavenumber 3.1 at the edge) against 16 modes (2.05 at the edge, the finest Scale then): the share of the speed above wavenumber 1.5 is 0.6 per cent and none above 2, the shares by band agree to 0.03 after 6 model time units, rms speed 0.862 against 0.861. The two states part like a chaotic pair (1.8e-2 apart after 1 time unit, 0.7 after 6).
// - Conjugate symmetry: with the line that restores it taken out, the asymmetry of the modes is 3.8e-8 of the amplitude at t = 12 (1e-16 at the start, growing at the rate of the roll modes, 1.6) and the field is NaN before t = 62. With it, none of the runs below has failed.
// - Saturation: the rms speed is 0.87 at the opening against sqrt(-alpha / beta) = 0.80 (1.09 times), 0.78 against 0.62 at Activity -1 (1.25), 0.99 against 1.00 at Activity 1; the speed is not pinned because the vortex cores and the walls between them are slow.
// - Chaos: the largest Lyapunov exponent, two states 1e-8 apart renormalised every model time unit over 300, noise off, is 0.70 at the opening (0.63 before the drag was added): a perturbation doubles in 1.0 model time units.
// - flowcheck, 240 s, six sets (open; all minimum; all maximum; three random) and 900 s (open; all minimum; all maximum): see the notes of the round for the table; the first update, which runs the 12 model time units before the first frame, took 0.8 s with two other jobs running, a frame 4.5 ms in Node (update and draw).
//
// What failed first. 1. alpha above 0 gave a mosaic of rolls with the colour of a random wave field, not vortices, and alpha -0.3 with a 28 LED wavelength settled into a standing checkerboard of eight cells (recur 0.00). 2. At alpha -1.6 four giant pinwheels fill the panel and stand still, so Activity stops at -0.99. 3. At the biggest Scale and Activity the saturated flow slowly coarsens into a few large cells: over 400 model time units the rate of change fell from 0.45 to 0.11 to 0.18 in seven of eight seeds and the all-maximum 240 s run gave recur 0.338. Noise at 0.03 to 0.06 cured it but made the picture boil and took the correlation time from 2.9 to 1.4; a drag on the largest scales (mu 0.5, k below 0.4) cured it with none: eight of eight seeds hold a rate of 0.54 to 0.69 for 400 time units (noise off). 4. The first colour wheel was HSV, a rainbow that the panel's saturation boost made neon; the Oklab ring at 0.6 of its chroma is the answer. 5. Scale below L 9 ran into the 16 modes (L 6: 241 extrema, noise). 6. The first clock, 0.3 per Flow, boiled: frames a second apart did not look like the same scene; 0.12 does.
//
// What was not checked: the real systems are three dimensional films with a free surface and the continuum constants here are not fitted to any of them; the box holds 3 to 6 vortices across where the experiments hold hundreds, so the statistics of a large crowd are not tested; the Gamma0 and Gamma2 are not the published values (from memory they were not kept); no comparison with measured vortex sizes or lifetimes; the mean flow is held at zero, which a real periodic box need not do; the extrema counts use one threshold.

const W = 64, H = 128, N = W * H;
const { floor, ceil, max, min, abs, sqrt, exp, log, pow, sin, cos, tanh, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

const KC = 16; // retained modes: m^2 + (n / 2)^2 <= KC^2, m the x index and n the y index

const CFG = {
  al0: 0.62, // |alpha| at Activity 0
  alr: 1.6, // and the ratio per unit of Activity
  g0: 2, // negative viscosity (Gamma0 = -g0)
  g2: 1, // hyperviscosity Gamma2
  beta: 1,
  lam: 8, // advection
  mu: 0.5, // drag on the largest scales
  kd: 0.4,
  noise: 0.01, // velocity noise per square root of model time, on modes below nk
  nk: 1.3,
  lam0: 14, // model length 2 pi in LEDs at Scale 0, which is the wavelength of the fastest mode
  lamr: 1.55, // ratio per unit of Scale below 0
  lamu: 1.25, // and above it
  c0: 0.12, // model time per panel second per unit of Flow
  hmax: 0.06,
  cfl: 1.5,
  kcfl: 2,
  pre: 12,
  base: 0.55, // heading ring offset
  dim: 0.34, // lightness lost where the water stands still
  chr: 0.6, // chroma of the ring, as a share of the knots'
  dl0: -0.04, // and its lightness, added
  spin: 0.2, // lightness given to one sense of rotation and taken from the other
};

// ---------------------------------------------------------------- Fourier transforms
function plan(n) {
  const sw = [], tw = new Float64Array(2 * n);
  let lg = 0;
  while (1 << lg < n) lg++;
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < lg; b++) if (i & (1 << b)) r |= 1 << (lg - 1 - b);
    if (r > i) sw.push(i, r);
  }
  for (let h = 1; h < n; h <<= 1)
    for (let k = 0; k < h; k++) {
      tw[2 * (h - 1 + k)] = cos((PI * k) / h);
      tw[2 * (h - 1 + k) + 1] = -sin((PI * k) / h);
    }
  return { n, sw: Int32Array.from(sw), tw };
}

// In place, along n contiguous entries from o: forward exp(-i...). The inverse is the same call with re and im swapped.
function fft1(re, im, o, P) {
  const n = P.n, sw = P.sw, tw = P.tw;
  for (let p = 0; p < sw.length; p += 2) {
    const i = o + sw[p], j = o + sw[p + 1];
    let t = re[i];
    re[i] = re[j];
    re[j] = t;
    t = im[i];
    im[i] = im[j];
    im[j] = t;
  }
  for (let a = o; a < o + n; a += 4) {
    const x0r = re[a], x0i = im[a], x1r = re[a + 1], x1i = im[a + 1];
    const x2r = re[a + 2], x2i = im[a + 2], x3r = re[a + 3], x3i = im[a + 3];
    const t0r = x0r + x1r, t0i = x0i + x1i, t1r = x0r - x1r, t1i = x0i - x1i;
    const t2r = x2r + x3r, t2i = x2i + x3i, t3r = x2r - x3r, t3i = x2i - x3i;
    re[a] = t0r + t2r;
    im[a] = t0i + t2i;
    re[a + 2] = t0r - t2r;
    im[a + 2] = t0i - t2i;
    re[a + 1] = t1r + t3i;
    im[a + 1] = t1i - t3r;
    re[a + 3] = t1r - t3i;
    im[a + 3] = t1i + t3r;
  }
  for (let half = 4; half < n; half <<= 1) {
    const len = half << 1, w0 = 2 * (half - 1);
    for (let s = o; s < o + n; s += len)
      for (let k = 0; k < half; k++) {
        const a = s + k, b = a + half, c = tw[w0 + 2 * k], d = tw[w0 + 2 * k + 1];
        const br = re[b], bi = im[b], xr = br * c - bi * d, xi = br * d + bi * c, ar = re[a], ai = im[a];
        re[b] = ar - xr;
        im[b] = ai - xi;
        re[a] = ar + xr;
        im[a] = ai + xi;
      }
  }
}

// Two-dimensional transforms of real fields on the W by H torus. Only the columns with |m| <= KC hold anything,
// so the column passes skip the rest, and two real rows share one complex transform.
const PW = plan(W), PH = plan(H), COL = [];
for (let j = 0; j < W; j++) if (abs(j < W / 2 ? j : j - W) <= KC) COL.push(j);
const CR = new Float64Array(H), CI = new Float64Array(H), ZR = new Float64Array(W), ZI = new Float64Array(W);
function cols(re, im, inv) {
  for (const j of COL) {
    for (let i = 0, p = j; i < H; i++, p += W) {
      CR[i] = re[p];
      CI[i] = im[p];
    }
    if (inv) fft1(CI, CR, 0, PH);
    else fft1(CR, CI, 0, PH);
    for (let i = 0, p = j; i < H; i++, p += W) {
      re[p] = CR[i];
      im[p] = CI[i];
    }
  }
}
// spectrum (re, im), laid out as the grid, to a real field; both arrays are used up
function ifft2real(re, im, out) {
  cols(re, im, true);
  for (let a = 0; a < H / 2; a++) {
    const oa = a * W, ob = (a + H / 2) * W;
    for (let j = 0; j < W; j++) {
      ZR[j] = re[oa + j] - im[ob + j];
      ZI[j] = im[oa + j] + re[ob + j];
    }
    fft1(ZI, ZR, 0, PW);
    for (let j = 0; j < W; j++) {
      out[oa + j] = ZR[j];
      out[ob + j] = ZI[j];
    }
  }
}
// real field in re to its spectrum in (re, im), not divided by N; only the retained columns are meaningful
function fft2real(re, im) {
  for (let a = 0; a < H / 2; a++) {
    const oa = a * W, ob = (a + H / 2) * W;
    for (let j = 0; j < W; j++) {
      ZR[j] = re[oa + j];
      ZI[j] = re[ob + j];
    }
    fft1(ZR, ZI, 0, PW);
    for (let j = 0; j < W; j++) {
      const q = (W - j) & (W - 1), zr = ZR[j], zi = ZI[j], qr = ZR[q], qi = ZI[q];
      re[oa + j] = 0.5 * (zr + qr);
      im[oa + j] = 0.5 * (zi - qi);
      re[ob + j] = 0.5 * (zi + qi);
      im[ob + j] = -0.5 * (zr - qr);
    }
  }
  cols(re, im, false);
}

// ---------------------------------------------------------------- the modes
const IDX = [], MM = [], NN = [], PAR = [];
{
  const at = new Map();
  for (let n = -2 * KC; n <= 2 * KC; n++)
    for (let m = -KC; m <= KC; m++) {
      if ((m === 0 && n === 0) || m * m + (n * n) / 4 > KC * KC) continue;
      at.set(m * 1000 + n, IDX.length);
      IDX.push(((n + H) % H) * W + ((m + W) % W));
      MM.push(m);
      NN.push(n);
    }
  for (let q = 0; q < IDX.length; q++) PAR.push(at.get(-MM[q] * 1000 - NN[q]));
}
const M = IDX.length;

function gauss() {
  return sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
}

const OPEN = [0, 2, 0, 0.06];
const dxOf = (s) => TAU / (CFG.lam0 * pow(s < 0 ? CFG.lamr : CFG.lamu, cl(s, -1, 1)));
const alphaOf = (a) => -CFG.al0 * pow(CFG.alr, cl(a, -1, 1));

function start(params, k) {
  const vec = () => new Float64Array(M), full = () => new Float64Array(N);
  const S = {
    tr: vec(), ti: vec(), k1r: vec(), k1i: vec(), k2r: vec(), k2i: vec(), k3r: vec(), k3i: vec(), k4r: vec(), k4i: vec(),
    ar: vec(), ai: vec(), // stage values
    kx: vec(), ky: vec(), k2: vec(), L: vec(), E: vec(), E2: vec(),
    gr: full(), gi: full(), u: full(), w: full(), wx: full(), wy: full(), a: full(), b: full(), c: full(), ai2: full(), bi: full(), ci: full(),
    dx: -1, alpha: 9, vmax: 1, t: 0, hue: 0,
  };
  params.s = S;
  prepare(S, dxOf(k[2]), alphaOf(k[3]));
  const sh = (kk) => exp(-pow((kk - 0.9) / 0.35, 2));
  for (let q = 0; q < M; q++) {
    if (PAR[q] < q) {
      S.tr[q] = S.tr[PAR[q]];
      S.ti[q] = -S.ti[PAR[q]];
    } else {
      const kk = sqrt(S.k2[q]), a = sh(kk) / kk;
      S.tr[q] = a * gauss();
      S.ti[q] = a * gauss();
    }
  }
  normalise(S, sqrt(-S.alpha));
  advance(S, CFG.pre, CFG.hmax);
}

function prepare(S, dx, alpha) {
  if (dx === S.dx && alpha === S.alpha) return;
  if (S.dx > 0) {
    const r = dx / S.dx; // keep the speed: v = k psi
    for (let q = 0; q < M; q++) {
      S.tr[q] *= r;
      S.ti[q] *= r;
    }
  }
  S.dx = dx;
  S.alpha = alpha;
  for (let q = 0; q < M; q++) {
    const x = (TAU * MM[q]) / (W * dx), y = (TAU * NN[q]) / (H * dx), k2 = x * x + y * y;
    S.kx[q] = x;
    S.ky[q] = y;
    S.k2[q] = k2;
    S.L[q] = -alpha + CFG.g0 * k2 - CFG.g2 * k2 * k2 - CFG.mu * exp(-k2 / (CFG.kd * CFG.kd));
  }
}

// velocity rms of the state
function speedRms(S) {
  let e = 0;
  for (let q = 0; q < M; q++) e += S.k2[q] * (S.tr[q] * S.tr[q] + S.ti[q] * S.ti[q]);
  return sqrt(e);
}
function normalise(S, target) {
  const s = target / speedRms(S);
  for (let q = 0; q < M; q++) {
    S.tr[q] *= s;
    S.ti[q] *= s;
  }
}

// ---------------------------------------------------------------- the equation
// With psi the stream function, u = psi_y, w = -psi_x, vorticity omega = -lap psi:
//   psi_t = L psi + (1 / k^2) [ -lam v.grad omega - beta curl(|v|^2 v) ]   (pressure gone with the curl),
// L(k) = -alpha + g0 k^2 - g2 k^4.
function nonlinear(S, tr, ti, oR, oI) {
  const { gr, gi, u, w, wx, wy, a, b, c, ai2, bi, ci, kx, ky, k2 } = S;
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    gr[IDX[q]] = -ky[q] * ti[q];
    gi[IDX[q]] = ky[q] * tr[q];
  }
  ifft2real(gr, gi, u);
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    gr[IDX[q]] = kx[q] * ti[q];
    gi[IDX[q]] = -kx[q] * tr[q];
  }
  ifft2real(gr, gi, w);
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    const f = kx[q] * k2[q];
    gr[IDX[q]] = -f * ti[q];
    gi[IDX[q]] = f * tr[q];
  }
  ifft2real(gr, gi, wx);
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    const f = ky[q] * k2[q];
    gr[IDX[q]] = -f * ti[q];
    gi[IDX[q]] = f * tr[q];
  }
  ifft2real(gr, gi, wy);
  let vm = 0;
  const beta = CFG.beta;
  for (let p = 0; p < N; p++) {
    const uu = u[p], ww = w[p], s = uu * uu + ww * ww;
    if (s > vm) vm = s;
    a[p] = uu * wx[p] + ww * wy[p];
    b[p] = s * uu;
    c[p] = s * ww;
  }
  S.vmax = sqrt(vm);
  fft2real(a, ai2);
  fft2real(b, bi);
  fft2real(c, ci);
  const sc = 1 / N, lam = CFG.lam;
  for (let q = 0; q < M; q++) {
    const o = IDX[q], x = kx[q], y = ky[q];
    const Mr = a[o] * sc, Mi = ai2[o] * sc, Xr = b[o] * sc, Xi = bi[o] * sc, Yr = c[o] * sc, Yi = ci[o] * sc;
    const cr = -x * Yi + y * Xi, ci_ = x * Yr - y * Xr; // curl of (s u, s w), as i kx Y - i ky X
    const i2 = 1 / k2[q];
    oR[q] = -(lam * Mr + beta * cr) * i2;
    oI[q] = -(lam * Mi + beta * ci_) * i2;
  }
}

function symmetrise(S) {
  const { tr, ti } = S;
  for (let q = 0; q < M; q++) {
    const p = PAR[q];
    if (p < q) continue;
    const a = 0.5 * (tr[q] + tr[p]), b = 0.5 * (ti[q] - ti[p]);
    tr[q] = tr[p] = a;
    ti[q] = b;
    ti[p] = -b;
  }
}

// integrating-factor Runge-Kutta 4 (Lawson, 1967)
function step(S, h) {
  const { tr, ti, k1r, k1i, k2r, k2i, k3r, k3i, k4r, k4i, ar, ai, L, E, E2 } = S;
  for (let q = 0; q < M; q++) {
    E2[q] = exp(0.5 * L[q] * h);
    E[q] = E2[q] * E2[q];
  }
  nonlinear(S, tr, ti, k1r, k1i);
  for (let q = 0; q < M; q++) {
    ar[q] = E2[q] * (tr[q] + 0.5 * h * k1r[q]);
    ai[q] = E2[q] * (ti[q] + 0.5 * h * k1i[q]);
  }
  nonlinear(S, ar, ai, k2r, k2i);
  for (let q = 0; q < M; q++) {
    ar[q] = E2[q] * tr[q] + 0.5 * h * k2r[q];
    ai[q] = E2[q] * ti[q] + 0.5 * h * k2i[q];
  }
  nonlinear(S, ar, ai, k3r, k3i);
  for (let q = 0; q < M; q++) {
    ar[q] = E[q] * tr[q] + h * E2[q] * k3r[q];
    ai[q] = E[q] * ti[q] + h * E2[q] * k3i[q];
  }
  nonlinear(S, ar, ai, k4r, k4i);
  for (let q = 0; q < M; q++) {
    tr[q] = E[q] * tr[q] + (h / 6) * (E[q] * k1r[q] + 2 * E2[q] * (k2r[q] + k3r[q]) + k4r[q]);
    ti[q] = E[q] * ti[q] + (h / 6) * (E[q] * k1i[q] + 2 * E2[q] * (k2i[q] + k3i[q]) + k4i[q]);
  }
  if (CFG.noise > 0) {
    const sh = CFG.noise * sqrt(h);
    for (let q = 0; q < M; q++) {
      const p = PAR[q];
      if (p < q) continue;
      const kk = sqrt(S.k2[q]), a = (sh * exp(-pow(kk / CFG.nk, 4))) / kk;
      tr[q] += a * gauss();
      ti[q] += a * gauss();
    }
  }
  symmetrise(S);
  S.t += h;
}

function advance(S, Ht, hmax) {
  for (let left = Ht; left > 1e-9; ) {
    const hc = min(hmax, CFG.cfl / (max(S.vmax, 0.2) * CFG.lam * CFG.kcfl));
    const h = left / ceil(left / hc - 1e-9);
    step(S, h);
    left -= h;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params, k);
  const S = params.s, ft = cl(dt || 0, 0, 0.1);
  prepare(S, dxOf(k[2]), alphaOf(k[3]));
  S.hue = k[0];
  const Ht = ft * CFG.c0 * cl(k[1], 0.5, 5);
  if (Ht > 0) advance(S, Ht, CFG.hmax);
  if (!(S.vmax < 12)) {
    params.s = null; // a blown field, which has not happened in any run: begin again
    update(dt, input, params);
  }
}

// ---------------------------------------------------------------- colour
// A closed ring of eight colours in Oklab (Bjorn Ottosson, 2020, from memory), one per 45 degrees of heading,
// joined by periodic cubic interpolation of lightness, chroma and hue: vermilion, marigold, spring green, aqua,
// cerulean, ultramarine, violet, rose. Lightness follows hue, so yellow stays light and blue stays deep.
const KNOTS = [
  [0.7, 0.17, 38],
  [0.84, 0.16, 80],
  [0.83, 0.17, 140],
  [0.8, 0.12, 190],
  [0.68, 0.13, 235],
  [0.52, 0.2, 268],
  [0.56, 0.21, 300],
  [0.66, 0.2, 345],
];
function ring(x, c) {
  // periodic Catmull-Rom through the knots' column c; hue is unwrapped so it climbs monotonically
  const n = KNOTS.length, f = (((x % 1) + 1) % 1) * n, i = floor(f), t = f - i;
  const g = (k) => {
    const j = (((i + k) % n) + n) % n;
    let v = KNOTS[j][c];
    if (c === 2 && i + k >= n) v += 360;
    if (c === 2 && i + k < 0) v -= 360;
    return v;
  };
  const p0 = g(-1), p1 = g(0), p2 = g(1), p3 = g(2);
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}
function srgb(x) {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1 / 2.4) - 0.055;
}
const RGB = [0, 0, 0];
function oklab(L, C, h) {
  for (let it = 0; it < 24; it++) {
    const a = C * cos((h * PI) / 180), b = C * sin((h * PI) / 180);
    const l = pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    if ((r >= -0.002 && r <= 1.002 && g >= -0.002 && g <= 1.002 && bl >= -0.002 && bl <= 1.002) || C < 0.004) {
      RGB[0] = cl(srgb(cl(r, 0, 1)), 0, 1);
      RGB[1] = cl(srgb(cl(g, 0, 1)), 0, 1);
      RGB[2] = cl(srgb(cl(bl, 0, 1)), 0, 1);
      return;
    }
    C *= 0.93;
  }
}
const NHUE = 256, NLIT = 40, DL0 = -0.34, DL1 = 0.12;
function buildLut() {
  const lut = new Uint8Array(NHUE * NLIT * 3);
  for (let i = 0; i < NHUE; i++) {
    const x = i / NHUE, L = ring(x, 0) + CFG.dl0, C = ring(x, 1) * CFG.chr, h = ring(x, 2);
    for (let j = 0; j < NLIT; j++) {
      oklab(cl(L + DL0 + ((DL1 - DL0) * j) / (NLIT - 1), 0.04, 0.97), C, h);
      const o = (i * NLIT + j) * 3;
      lut[o] = (RGB[0] * 255 + 0.5) | 0;
      lut[o + 1] = (RGB[1] * 255 + 0.5) | 0;
      lut[o + 2] = (RGB[2] * 255 + 0.5) | 0;
    }
  }
  return lut;
}
let LUT = null;

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (!LUT) LUT = buildLut();
  const { gr, gi, u, w, wx, kx, ky, k2, tr, ti } = S;
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    gr[IDX[q]] = -ky[q] * ti[q];
    gi[IDX[q]] = ky[q] * tr[q];
  }
  ifft2real(gr, gi, u);
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    gr[IDX[q]] = kx[q] * ti[q];
    gi[IDX[q]] = -kx[q] * tr[q];
  }
  ifft2real(gr, gi, w);
  gr.fill(0);
  gi.fill(0);
  for (let q = 0; q < M; q++) {
    gr[IDX[q]] = k2[q] * tr[q];
    gi[IDX[q]] = k2[q] * ti[q];
  }
  ifft2real(gr, gi, wx); // vorticity
  let s2 = 0, o2 = 0;
  for (let p = 0; p < N; p++) {
    s2 += u[p] * u[p] + w[p] * w[p];
    o2 += wx[p] * wx[p];
  }
  const vr = sqrt(s2 / N) + 1e-9, om = sqrt(o2 / N) + 1e-9, hue = S.hue + CFG.base;
  for (let p = 0; p < N; p++) {
    const sp = sqrt(u[p] * u[p] + w[p] * w[p]) / vr;
    const th = atan2(w[p], u[p]) / TAU + hue, hi = ((floor((th - floor(th)) * NHUE) % NHUE) + NHUE) % NHUE;
    const dl = -CFG.dim * (1 - sm(0.05, 0.9, sp)) + CFG.spin * tanh((wx[p] / om) * 0.8);
    const li = cl(((dl - DL0) / (DL1 - DL0)) * (NLIT - 1) + 0.5, 0, NLIT - 1) | 0, o = (hi * NLIT + li) * 3;
    display.setPixel(p & 63, p >> 6, LUT[o], LUT[o + 1], LUT[o + 2]);
  }
}
