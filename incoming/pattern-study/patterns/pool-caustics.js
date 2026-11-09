// ===== Patternflow pattern =====
// Title:   Pool Caustics
// Family:  light
// Idea:    Wind-ruffled water over a pool floor throws a web of bright refracted lines that folds, drifts, splits and rejoins as the waves run across it, and the whole floor keeps shimmering without ever settling to a picture that comes back.
// Author:  patternflow-lab
// Date:    2026-11-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Caustics of a rippled water surface, the ray map r' = r - D (1 - 1/n) grad h with the light gathered where the rays land (Michael Berry, Nye and Berry on caustics, 1970s; Stam, Caustics on rippled water, 1996, in the graphics form), over a linear wave sea of random phases on the deep-water dispersion (Tessendorf, Simulating Ocean Water, 2001)
// Round:   122
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.5..4, Scale=-1..1, Depth=-1..1
//
// Knob 1: Hue. Turns every colour of the pool round the grey axis by the knob times 360 degrees; at 0 the floor is deep teal and the lines pale aqua.
// Knob 2: Flow. Wave seconds per panel second: 0.5 is a slow lap of the water, 2 at the opening, 4 a stiff breeze.
// Knob 3: Scale. How long the waves are; the lines and their web get coarser as the knob goes up and finer as it goes down.
// Knob 4: Depth. How far below the water the floor lies: shallow gives a loose mesh of thin lines, deep gives a dense hot tangle.

const W = 64, H = 128, N = W * H, WM = W - 1, HM = H - 1;
const { floor, abs, sqrt, exp, log, cos, sin, atan2, PI, min, max, pow } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const CFG = {
  g: 20, // gravity, LEDs per second squared: omega = sqrt(g k)
  kLo: 0.24, // longest wave in the sea, rad per LED (26 LEDs)
  kHi: 0.9, // shortest (7 LEDs)
  disp: 2.4, // rms displacement of a ray by the surface, LEDs, at the opening depth
  nSets: 3,
  ss: 3, // rays per LED along each side
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

// ---- wavenumbers ----
const KX = new Float64Array(N), KY = new Float64Array(N), KM = new Float64Array(N);
for (let j = 0; j < H; j++)
  for (let i = 0; i < W; i++) {
    const p = j * W + i, nx = i < W / 2 ? i : i - W, ny = j < H / 2 ? j : j - H;
    KX[p] = (TAU * nx) / W;
    KY[p] = (TAU * ny) / H;
    KM[p] = sqrt(KX[p] * KX[p] + KY[p] * KY[p]);
  }
const MINUS = new Int32Array(N);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) MINUS[j * W + i] = ((H - j) & HM) * W + ((W - i) & WM);

// ---- one sea: random amplitudes round a heading, for the lobe of wavevectors that run that way ----
// The power law and the lobe are fixed here; the band of the Scale knob is read at every step.
function makeSet(heading) {
  const re = new Float64Array(N), im = new Float64Array(N), idx = [];
  for (let p = 0; p < N; p++) {
    const k = KM[p];
    if (k < 0.1 || k > 1.6) continue;
    const dth = atan2(KY[p], KX[p]) - heading, d = cos(0.5 * ((((dth + PI) % TAU) + TAU) % TAU - PI));
    const dir = pow(max(0, d), 8);
    if (dir < 1e-3) continue;
    const a = pow(k, -1.7) * sqrt(dir);
    re[p] = a * gauss();
    im[p] = a * gauss();
    idx.push(p);
  }
  const set = { re, im, idx: Int32Array.from(idx) };
  set.ph = new Float64Array(idx.length);
  set.env = new Float64Array(idx.length);
  for (let m = 0; m < idx.length; m++) set.ph[m] = TAU * Math.random();
  return set;
}

// ---- the rays: a fixed lattice of ss x ss to an LED, each reading the slope of the surface by bilinear weights ----
const SS = CFG.ss, NR = N * SS * SS;
const RA = new Int32Array(NR), RB = new Int32Array(NR), RC = new Int32Array(NR), RD = new Int32Array(NR);
const R0 = new Float32Array(NR), R1 = new Float32Array(NR), R2 = new Float32Array(NR), R3 = new Float32Array(NR);
const RX = new Float32Array(NR), RY = new Float32Array(NR);
(function lattice() {
  let r = 0;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++)
      for (let b = 0; b < SS; b++)
        for (let a = 0; a < SS; a++, r++) {
          const x = i + (a + 0.5) / SS, y = j + (b + 0.5) / SS, u = x - 0.5, v = y - 0.5;
          const i0 = floor(u), j0 = floor(v), fx = u - i0, fy = v - j0;
          const xa = i0 & WM, xb = (i0 + 1) & WM, ya = j0 & HM, yb = (j0 + 1) & HM;
          RA[r] = ya * W + xa;
          RB[r] = ya * W + xb;
          RC[r] = yb * W + xa;
          RD[r] = yb * W + xb;
          R0[r] = (1 - fx) * (1 - fy);
          R1[r] = fx * (1 - fy);
          R2[r] = (1 - fx) * fy;
          R3[r] = fx * fy;
          RX[r] = x;
          RY[r] = y;
        }
})();

// ---- state ----
function start(params) {
  const S = {
    sets: [],
    zr: new Float64Array(N), zi: new Float64Array(N),
    dens: new Float32Array(N),
    lw: [], ux: 0, uy: 0, // log weight of each sea, and the current: both wander
    sc: 1, dp: 1, hue: 0, lutHue: -9, lut: new Uint8Array(256 * 3), G: CFG.disp,
    ready: false,
  };
  const h0 = TAU * Math.random();
  for (let s = 0; s < CFG.nSets; s++) {
    S.sets.push(makeSet(h0 + (TAU * s) / CFG.nSets + 0.5 * (Math.random() - 0.5)));
    S.lw.push(0.7 * gauss());
  }
  params.s = S;
  S.ready = true;
}

const scOf = (v) => pow(1.45, cl(v, -1.2, 1.2));
const dpOf = (v) => pow(1.7, cl(v, -1.2, 1.2));

// one step of the sea, dtw wave seconds: the packed slope field Z = gx + i gy in the spectrum
function advance(S, dtw) {
  const sc = S.sc, g = CFG.g, kl = CFG.kLo / sc, kh = CFG.kHi / sc;
  const a = exp(-dtw / 60), b = sqrt(1 - a * a);
  for (let s = 0; s < S.sets.length; s++) S.lw[s] = a * S.lw[s] + b * 0.9 * gauss();
  S.ux = a * S.ux + b * 0.7 * gauss();
  S.uy = a * S.uy + b * 0.7 * gauss();
  const w = [];
  let s2 = 0;
  for (let s = 0; s < S.sets.length; s++) {
    const set = S.sets[s], idx = set.idx, ws = exp(S.lw[s]);
    w[s] = ws;
    for (let m = 0; m < idx.length; m++) {
      const p = idx[m], k = KM[p], e = exp(-pow(kl / k, 4)) * exp(-pow(k / kh, 4));
      set.env[m] = e;
      s2 += ws * ws * e * e * (set.re[p] * set.re[p] + set.im[p] * set.im[p]) * k * k;
    }
  }
  const norm = 1 / sqrt(s2 + 1e-12); // every component of the slope has variance 1: 2 sum |c|^2 k^2 over both signs = 2
  const er = S.zr, ei = S.zi;
  er.fill(0);
  ei.fill(0);
  for (let s = 0; s < S.sets.length; s++) {
    const set = S.sets[s], idx = set.idx, ph = set.ph, ws = w[s] * norm;
    for (let m = 0; m < idx.length; m++) {
      const p = idx[m], kx = KX[p], ky = KY[p];
      ph[m] += (sqrt(g * KM[p]) + kx * S.ux + ky * S.uy) * dtw;
      const f = set.env[m] * ws, cr = set.re[p] * f, ci = set.im[p] * f, c = cos(ph[m]), sn = sin(ph[m]);
      const hr = cr * c + ci * sn, hi = ci * c - cr * sn; // c e^{-i phase}
      er[p] += -kx * hi - ky * hr; // i (kx + i ky) h
      ei[p] += kx * hr - ky * hi;
      const q = MINUS[p]; // the mirror, conj(h) at -k
      er[q] += -kx * hi + ky * hr;
      ei[q] += -kx * hr - ky * hi;
    }
  }
}

// ---- the light on the floor: every ray leaves the surface straight down, bends by G times the slope, and drops its share where it lands ----
function gather(S) {
  fft2(S.zr, S.zi, true);
  const GX = S.zr, GY = S.zi, D = S.dens, G = S.G, wt = 1 / (SS * SS);
  D.fill(0);
  for (let r = 0; r < NR; r++) {
    const A = RA[r], B = RB[r], C = RC[r], E = RD[r], w0 = R0[r], w1 = R1[r], w2 = R2[r], w3 = R3[r];
    const gx = w0 * GX[A] + w1 * GX[B] + w2 * GX[C] + w3 * GX[E];
    const gy = w0 * GY[A] + w1 * GY[B] + w2 * GY[C] + w3 * GY[E];
    const u = RX[r] - 0.5 - G * gx, v = RY[r] - 0.5 - G * gy;
    const i0 = floor(u), j0 = floor(v), fx = u - i0, fy = v - j0;
    const xa = i0 & WM, xb = (i0 + 1) & WM, ya = (j0 & HM) * W, yb = ((j0 + 1) & HM) * W;
    D[ya + xa] += wt * (1 - fx) * (1 - fy);
    D[ya + xb] += wt * fx * (1 - fy);
    D[yb + xa] += wt * (1 - fx) * fy;
    D[yb + xb] += wt * fx * fy;
  }
}

export function update(dt, input, params) {
  const k = input.knobValues || OPEN;
  if (!params.s) start(params);
  const S = params.s, ft = cl(dt || 0, 0, 0.1), flow = cl(k[1], 0.1, 8);
  S.hue = cl(k[0], 0, 1);
  const f = 1 - exp(-ft / 0.6);
  S.sc += (scOf(k[2]) - S.sc) * f;
  S.dp += (dpOf(k[3]) - S.dp) * f;
  S.G = CFG.disp * S.sc * S.dp;
  advance(S, ft * flow * 0.12);
  gather(S);
}

// ---- colour ----
const STOPS = [
  [0.0, 22, 72, 128],
  [0.3, 24, 108, 150],
  [0.6, 56, 170, 190],
  [0.82, 150, 226, 214],
  [1.0, 250, 255, 238],
];
function buildLut(S, hue) {
  const a = hue * TAU, c = cos(a), s = sin(a), k1 = (1 - c) / 3, k2 = sqrt(1 / 3) * s;
  const m = [c + k1, k1 - k2, k1 + k2, k1 + k2, c + k1, k1 - k2, k1 - k2, k1 + k2, c + k1];
  for (let i = 0; i < 256; i++) {
    const b = i / 255;
    let j = 0;
    while (j < STOPS.length - 2 && b > STOPS[j + 1][0]) j++;
    const A = STOPS[j], B = STOPS[j + 1], t = cl((b - A[0]) / (B[0] - A[0]), 0, 1);
    const r = A[1] + (B[1] - A[1]) * t, g = A[2] + (B[2] - A[2]) * t, bl = A[3] + (B[3] - A[3]) * t;
    S.lut[i * 3] = cl(m[0] * r + m[1] * g + m[2] * bl, 0, 255);
    S.lut[i * 3 + 1] = cl(m[3] * r + m[4] * g + m[5] * bl, 0, 255);
    S.lut[i * 3 + 2] = cl(m[6] * r + m[7] * g + m[8] * bl, 0, 255);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  if (S.lutHue !== S.hue) (S.lutHue = S.hue), buildLut(S, S.hue);
  const { dens, lut } = S;
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const d = dens[p], b = 1 - exp(-0.9 * d);
      const o = ((cl(b, 0, 1) * 255 + 0.5) | 0) * 3;
      display.setPixel(x, y, lut[o], lut[o + 1], lut[o + 2]);
    }
}
