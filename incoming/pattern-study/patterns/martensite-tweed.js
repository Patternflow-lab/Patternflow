// ===== Patternflow pattern =====
// Title:   Martensite Tweed
// Family:  mineral
// Idea:    A crystal that keeps being warmed and cooled through its square-to-rectangle change: strain relaxes in a field whose elastic penalty vanishes along the two diagonals, so the two variants lock into 45-degree twin bands that melt into a woven tweed and freeze again differently each time.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ferroelastic Landau theory with the compatibility penalty on a strain field, Gerard Barsch and James Krumhansl (1984); pretransitional tweed from quenched disorder, Kartha, Castan, Krumhansl and Sethna (1991)
// Round:   129
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..2.5, Scale=-1..1, Disorder=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the two variants are amber and blue with a lilac grey between them for the parent phase.
// Knob 2: Speed. How fast the crystal is cooled, warmed and relaxed: the model runs 8 time units a panel second times Speed.
// Knob 3: Scale. Stiffness of the walls and of the long wavelengths: low gives fine twins and a sharp weave, high gives wide bands with soft walls.
// Knob 4: Disorder. Strength of the frozen impurities that seed the tweed: low gives clean laminates, high gives a mottled cloth that never settles into bands.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, abs, max, min, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

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

// What the crystal is. One number e on every LED of the 64 by 128 torus, the deviatoric strain of a square lattice that can turn into a rectangle
// lying one way (e > 0) or the other (e < 0). It relaxes down a free energy
//   d e / dt = -(tau + L(k)) e - e^3 - d(x) e + h + noise,     L(k) = kappa k^2 + A ((kx^2 - ky^2) / k^2)^2 + D exp(-k^2 / 2 kc^2)
// in Fourier space. tau is the temperature: above 0 the parent square phase is stable and below it the rectangles grow. The term that makes this a
// martensite and not a Cahn-Hilliard coarsening is the middle one, the compatibility penalty. A strain field has to be a displacement field, and
// that costs energy for every wave vector except those with kx = +-ky: so a band of one variant between two of the other costs nothing when its
// walls run at 45 degrees, and anything else is pushed back. The last term lets the long waves cost something, so the two variants share the panel.
// d(x) is a frozen random field of local transition temperatures, smooth over about 1.5 LEDs. It seeds the tweed: where it is below -tau a patch
// goes over early, and the penalty stretches the patch along a diagonal. It rotates slowly between two random fields, so impurities anneal and the
// weave is never the same twice. h is a slow uniform stress, which pushes the walls so one variant grows and the other shrinks.
// The temperature is three sines of incommensurate slow frequencies, so the crystal passes the transition at random-looking times and depths:
// deep below it the bands are clean, near it they thin into tweed, above it the strain is thermal fluctuation drawn out along the diagonals.

const DT = 0.5; // largest model step, time units
const RATE = 8; // model time units a panel second at Speed 1
const A = 40, KAP = 0.06, D1 = 0.25, KC = 0.6, D0 = 0.5, SIG = 0.22, XI = 1.5, NOISE = 0.03, C4 = 0.03;
const OPEN = [0, 2, 0, 0.06];
// the temperature and the stress, as functions of model time
const W1 = 0.0197, W2 = 0.0113, W3 = 0.0271, WD = 0.002;
const tauAt = (t) => -0.05 + 0.09 * sin(W1 * t + 0.4) + 0.07 * sin(W2 * t + 2.1) + 0.04 * sin(W3 * t + 4.0);
// the stress: a smooth random field built from long waves, each wave travelling at its own slow rate
const HAMP = 0.14, XS = 5, WMIN = 0.004, WSPAN = 0.012;

function setup(params) {
  const f = () => new Float64Array(N);
  const S = { e: f(), re: f(), im: f(), Lk: f(), n1: f(), n2: f(), hs: f(), hsc: 1, mi: null, ma: null, mb: null, mw: null, tm: f(), gain: 0.2, t: 0, ls: 99, warm: false, hue: 0, lut: new Float32Array(512 * 3), lutHue: -1 };
  params.s = S;
  return S;
}

// Smooth unit-variance random field from white noise, through a Gaussian of width xi in Fourier space.
function noiseField(S, out, xi) {
  const re = S.re, im = S.im;
  for (let p = 0; p < N; p++) (re[p] = Math.random() - 0.5), (im[p] = 0);
  fft2(re, im, false);
  for (let y = 0; y < H; y++) {
    const ky = (TAU * (y < H / 2 ? y : y - H)) / H;
    for (let x = 0; x < W; x++) {
      const kx = (TAU * (x < W / 2 ? x : x - W)) / W, g = exp(-0.5 * (kx * kx + ky * ky) * xi * xi);
      re[y * W + x] *= g;
      im[y * W + x] *= g;
    }
  }
  fft2(re, im, true);
  let s = 0;
  for (let p = 0; p < N; p++) s += re[p] * re[p];
  const sc = sqrt(N / s);
  for (let p = 0; p < N; p++) out[p] = re[p] * sc;
}

// The linear operator L(k), laid out like the FFT output. The mean mode costs D0, so a uniform stress moves walls and does not just tilt the crystal.
function operator(S, scale) {
  const kap = KAP * exp(0.7 * scale), kc = KC * exp(0.35 * scale), Lk = S.Lk;
  for (let y = 0; y < H; y++) {
    const ky = (TAU * (y < H / 2 ? y : y - H)) / H;
    for (let x = 0; x < W; x++) {
      const kx = (TAU * (x < W / 2 ? x : x - W)) / W, k2 = kx * kx + ky * ky, d = kx * kx - ky * ky;
      Lk[y * W + x] = k2 === 0 ? D0 : kap * k2 + C4 * k2 * k2 + (A * d * d) / (k2 * k2) + D1 * exp((-0.5 * k2) / (kc * kc));
    }
  }
  S.ls = scale;
}

// One semi-implicit step of h time units: the linear part is divided out in Fourier space, the cubic, the disorder, the stress and the noise go in
// explicitly. One forward and one inverse transform, because (e + h N) transforms to e-hat + h N-hat.
function step(S, h, tau, sig, cs, sn) {
  const { e, re, im, Lk, n1, n2, hs } = S;
  const nz = (NOISE * sqrt(12)) / sqrt(h), tm = S.tm;
  for (let p = 0; p < N; p++) tm[p] = Math.random() - 0.5;
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, v = e[p], d = sig * (cs * n1[p] + sn * n2[p]);
      // white noise, averaged with its four neighbours so the thermal speckle is wider than one LED
      const z = (tm[p] + 0.5 * (tm[om + x] + tm[op + x] + tm[o + ((x + W - 1) % W)] + tm[o + ((x + 1) % W)])) / 3;
      re[p] = v + h * (-(d * v + v * v * v) + hs[p] + nz * z);
      im[p] = 0;
    }
  }
  fft2(re, im, false);
  for (let p = 0; p < N; p++) {
    const f = 1 / (1 + h * (Lk[p] + tau)) / N;
    re[p] *= f;
    im[p] *= f;
  }
  fft2(re, im, true);
  for (let p = 0; p < N; p++) e[p] = re[p];
}

// One step at the model time S.t.
function stepAt(S, h, sig) {
  const t = S.t, d = WD * t;
  step(S, h, tauAt(t), sig, cos(d), sin(d));
}

// The stress field at model time t: every long wave j has a random complex amplitude and a rate, and the field is the real part of their sum.
function stressField(S, t) {
  const { re, im, hs, mi, ma, mb, mw } = S;
  re.fill(0);
  im.fill(0);
  for (let j = 0; j < mi.length; j++) {
    const p = mi[j], a = mw[j] * t, c = cos(a), s = sin(a);
    re[p] = ma[j] * c - mb[j] * s;
    im[p] = ma[j] * s + mb[j] * c;
  }
  fft2(re, im, true);
  const g = HAMP * S.hsc;
  for (let p = 0; p < N; p++) hs[p] = re[p] * g;
}
function stressSetup(S) {
  const idx = [], A = [], B = [], Wr = [];
  const gauss = () => sqrt(-2 * Math.log(Math.random() + 1e-12)) * cos(TAU * Math.random());
  for (let y = 0; y < H; y++) {
    const ky = (TAU * (y < H / 2 ? y : y - H)) / H;
    for (let x = 0; x < W; x++) {
      const kx = (TAU * (x < W / 2 ? x : x - W)) / W, env = exp(-0.25 * (kx * kx + ky * ky) * XS * XS);
      if ((x || y) && env > 0.04) {
        idx.push(y * W + x);
        A.push(env * gauss());
        B.push(env * gauss());
        Wr.push((WMIN + WSPAN * Math.random()) * (Math.random() < 0.5 ? -1 : 1));
      }
    }
  }
  S.mi = Int32Array.from(idx);
  S.ma = Float64Array.from(A);
  S.mb = Float64Array.from(B);
  S.mw = Float64Array.from(Wr);
  stressField(S, 0);
  let m = 0;
  for (let p = 0; p < N; p++) m += S.hs[p] * S.hs[p];
  S.hsc = 1 / (sqrt(m / N) / HAMP);
}

function advance(S, ft, k) {
  const scale = cl(k[2], -1, 1), sig = SIG * exp(0.7 * cl(k[3], -1, 1)), speed = cl(k[1], 1, 2.5);
  if (abs(scale - S.ls) > 0.01) operator(S, S.ls + (scale - S.ls) * (1 - exp(-ft / 0.3)));
  const hh = ft * RATE * speed, n = max(1, Math.ceil(hh / DT - 1e-9)), h = hh / n;
  stressField(S, S.t);
  for (let i = 0; i < n; i++) {
    S.t += h;
    stepAt(S, h, sig);
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.hue = k[0];
  if (!S.warm) {
    S.warm = true;
    noiseField(S, S.n1, XI);
    noiseField(S, S.n2, XI);
    stressSetup(S);
    for (let p = 0; p < N; p++) S.e[p] = 0.05 * (Math.random() - 0.5);
    S.ls = 99;
    operator(S, cl(k[2], -1, 1));
    const sig = SIG * exp(0.7 * cl(k[3], -1, 1));
    S.t = -150;
    for (let i = 0; i < 300; i++) {
      if (i % 15 === 0) stressField(S, S.t);
      S.t += DT;
      stepAt(S, DT, sig);
    }
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

// ---- colour ---------------------------------------------------------------------------------
// The strain, divided by a slowly following gain so the weave keeps full contrast whether the crystal is deep in the rectangle phase or just a
// thermal shimmer above it, goes through a diverging palette from blue (one variant) through a lilac grey (the parent) to amber (the other). Where
// the strain changes fast, the walls, the colour is pulled toward white.
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// stops: u = -1, -0.5, 0, 0.5, 1 as hue, saturation, value
const STOPS = [
  [0.6, 0.9, 0.95],
  [0.5, 0.75, 0.9],
  [0.78, 0.3, 0.8],
  [0.07, 0.65, 0.95],
  [0.02, 0.9, 1.0],
];
function buildLut(S, hue) {
  const tmp = [0, 0, 0];
  for (let i = 0; i < 512; i++) {
    const u = (i / 511) * 2 - 1, x = (u + 1) * 2, a = min(3, floor(x)), f = x - a, p = STOPS[a], q = STOPS[a + 1];
    let dh = q[0] - p[0];
    dh -= Math.round(dh);
    hsv(p[0] + dh * f + hue, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, tmp, 0);
    S.lut[i * 3] = tmp[0];
    S.lut[i * 3 + 1] = tmp[1];
    S.lut[i * 3 + 2] = tmp[2];
  }
  S.lutHue = hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  // the whole palette drifts a little, the way the colours of a crystal between crossed polarisers shift as it warms and cools
  const hh = S.hue + 0.07 * sin(0.0071 * S.t + 1) + 0.05 * sin(0.0043 * S.t + 3) + 0.03 * sin(0.0101 * S.t + 5.3);
  if (abs(S.lutHue - hh) > 0.002) buildLut(S, hh);
  const e = S.e;
  let m = 0;
  for (let p = 0; p < N; p++) m += e[p] * e[p];
  const rms = sqrt(m / N);
  S.gain += (max(rms * 2.2, 0.05) - S.gain) * 0.03;
  const g = S.gain, lut = S.lut;
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, xm = o + ((x + W - 1) % W), xp = o + ((x + 1) % W);
      const u = cl(e[p] / g, -1, 1);
      const gx = (e[xp] - e[xm]) / g, gy = (e[op + x] - e[om + x]) / g;
      const w = sstep(0.25, 1.1, sqrt(gx * gx + gy * gy));
      const i = ((u + 1) * 255.5) | 0, r = lut[i * 3], gg = lut[i * 3 + 1], b = lut[i * 3 + 2];
      const k = 255;
      display.setPixel(x, y, k * (r + (1 - r) * w * 0.55), k * (gg + (1 - gg) * w * 0.55), k * (b + (1 - b) * w * 0.55));
    }
  }
}
