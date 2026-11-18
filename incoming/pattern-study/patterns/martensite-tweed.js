// ===== Patternflow pattern =====
// Title:   Martensite Tweed
// Family:  mineral
// Idea:    A crystal warmed and cooled through its square-to-rectangle change, where the strain field pays no elastic cost along the two diagonals, so the two variants weave into 45-degree threads that melt to a mottled tweed and freeze again differently each time.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ferroelastic Landau theory with the compatibility penalty on a strain field, Gerard Barsch and James Krumhansl (1984); pretransitional tweed from quenched disorder, Kartha, Castan, Krumhansl and Sethna (1991)
// Round:   129
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=1..2.5, Scale=-1..1, Disorder=-1..1
//
// Knob 1: Hue. Turns the whole palette round the wheel. At 0 the two variants are amber and blue with a lilac grey between them for the parent phase, and the palette drifts a little either side as the crystal warms and cools.
// Knob 2: Speed. How fast the crystal relaxes toward what the temperature and the stress ask of it, 8 to 20 relaxation time units a second. The temperature and the stress move at 8 to 14 time units a second.
// Knob 3: Scale. How coarse the weave is: the stress that bends the crystal has a correlation length of 2.5 LEDs at -1 and 5 at +1, and the long waves are let in at a wavelength of 6 LEDs at -1 and 19 at +1, so low gives fine threads and high gives wide patches with wide bands between them.
// Knob 4: Disorder. Strength of the frozen impurities that seed the tweed, 0.11 at -1, 0.22 at 0, 0.44 at +1: low gives smooth patches with a few threads, high gives a dense cloth of crossing threads.

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
// lying one way (e > 0) or the other (e < 0). In Fourier space it relaxes as
//   d e / dt = -(tau + L(k)) e - e^3 - d(x) e + h(x, t) + noise,   L(k) = kappa k^2 + C k^4 + A ((kx^2 - ky^2) / k^2)^2 + D exp(-k^2 / 2 kc^2)
// tau is the temperature: above 0 the parent square phase is stable, below it the rectangles grow. The term that makes this a martensite and not a
// Cahn-Hilliard coarsening is the A term, the compatibility penalty. A strain field has to come from a displacement field, and that costs energy for
// every wave vector except those with kx = +-ky, so a thread of one variant between two of the other is free when its walls run at 45 degrees and
// anything else is pushed back. kappa is the wall stiffness, C k^4 keeps the field from going to single-LED stripes, and the D term makes the long
// waves cost something, so the two variants share the panel instead of one taking it. The mean mode costs 0.5, which stops the panel going all one variant.
// d(x) is a frozen random field of local transition temperatures, smooth over 1.5 LEDs. It seeds the tweed: where it is below -tau a patch goes
// over early, and the penalty stretches the patch along a diagonal. It turns slowly between two random fields, so the impurities anneal and the
// weave is not the same twice. h is a stress field, the real part of about 1500 long waves that each travel at their own slow rate, scaled to a fixed
// deviation of 0.14. It decides which variant each region takes and where the walls sit, and it is what keeps frames 20 s apart far from each other.
// The temperature is a sum of 8 sines with random rates between 0.008 and 0.035 a time unit, so the crystal passes the transition at times and depths
// that do not come round together: deep below it there are threads of both variants with white walls, near it they thin into tweed, above it the
// strain is a thermal fluctuation drawn out along the diagonals. The rates and phases are drawn when the pattern starts, so no two runs match.
// What was measured, with the file's own code run 240 s at 30 fps and a frame kept every half second, each frame cut to 8 by 8 LED means for recur and
// to 16 by 16 LED cells for the rest. At the opening, all knobs at their minimum, all at their maximum and three other positions: recur 0.464 to
// 0.622, the darkest cell 0.957 to 0.982 of the mean, the least-changing cell 0.711 to 0.898 of the mean change, and over the last quarter 0.914 to
// 0.967 and 0.573 to 0.762. The first and last quarters differ in mean brightness by 0.2% to 1.6%. For 900 s at the opening, at the minimum and at the
// maximum nothing dies, blows up or drifts: recur 0.402 to 0.586, the least-changing cell 0.903 to 0.944, brightness first against last quarter within 0.3%.
// Over eight other seeds recur was 0.50 to 0.63 at the opening, 0.48 to 0.61 at all-maximum and 0.57 to 0.74 at all-minimum, so these are not one lucky draw. The slow pieces are what
// the recur line needs: with the temperature on three sines and the stress on a few long waves, frames 20 s apart came back to 0.31 to 0.39 because
// the crystal passed through the same few laminate states; many random waves and a short length for the stress broke that.
// The scheme is semi-implicit, one forward and one inverse transform a step: (1 + h (L + tau)) divides in Fourier space, and the cube, the disorder,
// the stress and the noise go in explicitly. Heun or a smaller step would change nothing a person could see at h = 0.5.

const DT = 0.5; // largest model step, time units
const RATE = 8; // relaxation time units a panel second at Speed 1
const DRIVE = 8; // time units a panel second for the temperature, the stress and the impurities at Speed 1; it grows as Speed to the 0.6
const A = 20, KAP = 0.06, D1 = 0.6, KC = 0.6, D0 = 0.5, SIG = 0.22, XI = 1.5, NOISE = 0.03, C4 = 0.08;
const OPEN = [0, 2, 0, 0.06];
const WD = 0.002, NT = 8, TAU0 = -0.05, TAMP = 0.0425, HUEAMP = 0.03;
// Temperature and palette drift: each a sum of 8 sines with random rates, so there is no pair of times at which both come round together.
const tauAt = (S, t) => {
  let v = TAU0;
  for (let i = 0; i < NT; i++) v += TAMP * sin(S.tw[i] * t + S.tp[i]);
  return v;
};
const hueAt = (S, t) => {
  let v = 0;
  for (let i = 0; i < NT; i++) v += HUEAMP * sin(S.hw[i] * t + S.hp[i]);
  return v;
};
// The stress: long waves with a Gaussian spectrum, each travelling at its own rate between WMIN and WMIN + WSPAN time units.
const HAMP = 0.14, XS = 3.5, XS0 = 2.5, WMIN = 0.004, WSPAN = 0.012;

function setup(params) {
  const f = () => new Float64Array(N);
  const S = { e: f(), re: f(), im: f(), Lk: f(), n1: f(), n2: f(), hs: f(), mk: null, mi: null, ma: null, mb: null, mw: null, tw: new Float64Array(NT), tp: new Float64Array(NT), hw: new Float64Array(NT), hp: new Float64Array(NT), tm: f(), gain: 0.2, t: 0, ls: 99, warm: false, hue: 0, lut: new Float32Array(512 * 3), lutHue: -1 };
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

// The linear operator L(k), laid out like the FFT output. Scale sets the wall stiffness (kappa) and the wavelength below which the long waves cost D.
function operator(S, scale) {
  const kap = KAP * exp(0.7 * scale), kc = KC * exp(-0.6 * scale), Lk = S.Lk;
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

// One step at the drive time S.t.
function stepAt(S, h, sig) {
  const t = S.t, d = WD * t;
  step(S, h, tauAt(S, t), sig, cos(d), sin(d));
}

// The stress field at model time t: every long wave j has a random complex amplitude and a rate, and the field is the real part of their sum.
// The waves are stored for a correlation length of XS0 LEDs and cut down here to XS exp(0.35 Scale), and the field is scaled to a fixed deviation.
function stressField(S, t) {
  const { re, im, hs, mi, ma, mb, mw, mk } = S;
  const xs = XS * exp(0.35 * cl(S.ls, -1, 1)), q = 0.25 * (xs * xs - XS0 * XS0);
  re.fill(0);
  im.fill(0);
  let v = 0;
  for (let j = 0; j < mi.length; j++) {
    const p = mi[j], a = mw[j] * t, c = cos(a), s = sin(a), f = exp(-q * mk[j]);
    re[p] = f * (ma[j] * c - mb[j] * s);
    im[p] = f * (ma[j] * s + mb[j] * c);
    v += f * f * (ma[j] * ma[j] + mb[j] * mb[j]);
  }
  fft2(re, im, true);
  const g = HAMP / sqrt(0.5 * v);
  for (let p = 0; p < N; p++) hs[p] = re[p] * g;
}
function stressSetup(S) {
  const idx = [], AR = [], BR = [], Wr = [], K = [];
  const gauss = () => sqrt(-2 * Math.log(Math.random() + 1e-12)) * cos(TAU * Math.random());
  for (let y = 0; y < H; y++) {
    const ky = (TAU * (y < H / 2 ? y : y - H)) / H;
    for (let x = 0; x < W; x++) {
      const kx = (TAU * (x < W / 2 ? x : x - W)) / W, k2 = kx * kx + ky * ky, env = exp(-0.25 * k2 * XS0 * XS0);
      if ((x || y) && env > 0.03) {
        idx.push(y * W + x);
        AR.push(env * gauss());
        BR.push(env * gauss());
        K.push(k2);
        Wr.push((WMIN + WSPAN * Math.random()) * (Math.random() < 0.5 ? -1 : 1));
      }
    }
  }
  S.mi = Int32Array.from(idx);
  S.ma = Float64Array.from(AR);
  S.mb = Float64Array.from(BR);
  S.mk = Float64Array.from(K);
  S.mw = Float64Array.from(Wr);
}

function advance(S, ft, k) {
  const scale = cl(k[2], -1, 1), sig = SIG * exp(0.7 * cl(k[3], -1, 1)), speed = cl(k[1], 1, 2.5);
  if (abs(scale - S.ls) > 0.01) operator(S, S.ls + (scale - S.ls) * (1 - exp(-ft / 0.3)));
  const hh = ft * RATE * speed, n = max(1, Math.ceil(hh / DT - 1e-9)), h = hh / n, dc = (ft * DRIVE * Math.pow(speed, 0.6)) / n;
  stressField(S, S.t);
  for (let i = 0; i < n; i++) {
    S.t += dc;
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
    for (let i = 0; i < NT; i++) {
      S.tw[i] = 0.008 + 0.027 * Math.random();
      S.tp[i] = TAU * Math.random();
      S.hw[i] = 0.003 + 0.009 * Math.random();
      S.hp[i] = TAU * Math.random();
    }
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
// The strain, divided by a slowly following gain so the weave keeps full contrast whether the crystal is deep in the rectangle phase or only a
// thermal shimmer above it, goes through a diverging palette from blue (one variant) through a lilac grey (the parent) to amber (the other). Where
// the strain changes fast, the twin walls, the colour is pulled toward white, the way a wall shows between crossed polarisers.
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
  const hh = S.hue + hueAt(S, S.t);
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
      display.setPixel(x, y, 255 * (r + (1 - r) * w * 0.55), 255 * (gg + (1 - gg) * w * 0.55), 255 * (b + (1 - b) * w * 0.55));
    }
  }
}
