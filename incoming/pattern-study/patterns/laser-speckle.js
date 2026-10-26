// ===== Patternflow pattern =====
// Title:   Laser Speckle
// Family:  noise
// Idea:    Laser light through a diffuser: the panel is the Fourier transform of a small pupil full of random phases, so every LED is the sum of 191 random phasors, lit by the squared length of the sum and coloured by its phase; the grains boil as the diffuser's phases turn, a window at the top shows the pupil changing from disc to ring, pinhole pair, square, slit and triangle while the grains take the shape of its diffraction pattern, and the histogram along the bottom follows the exponential law e^-I.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: laser speckle as a random walk of phasors (Lord Rayleigh, 1880), the statistics of speckle (J. W. Goodman, 1975), pattern round 59
// Round:   59
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Pupil=5..14, Looks=1..8
//
// Knob 1: Hue. Adds one phase to the whole field, which turns every grain's hue round the wheel together; the window's tint and the bars turn with it. At 0 the bars are blue and the curve over them cream.
// Knob 2: Speed. How fast the diffuser turns and the pupil changes shape. Every sample's phase turns at its own rate, normal with a spread of 0.9 radians a second at 2, so the intensity at an LED is correlated exp(-0.81 t^2) with itself t seconds before: half after 0.93 s, 0.15 after 1.5 s; each of the eight pupils holds 9 s, the last 2.5 of them blending into the next. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Pupil. The pupil's radius in samples of the frequency plane, 5 to 14 across and twice that down, since the panel has twice as many rows as columns; the disc holds 191 samples at 5 and 1,321 at 14. A bigger pupil makes finer grains: the intensity's autocorrelation falls to half 3.4 LEDs out at 5, 2.1 at 8 and 1.2 at 14, so a grain is about 66 LEDs over the pupil's diameter in samples, against (2 J1(z) / z)^2 = 1/2 at z = 1.62. The window draws the pupil at one size; its shape, not its size, is what it shows.
// Knob 4: Looks. How many speckle patterns from independent diffusers are added, 1 to 8. One look has contrast sigma / <I> of 1.00 and the exponential histogram; 2 have 0.70, 4 have 0.49 and 8 have 0.35, as 1 / sqrt(n), and the histogram rises into the gamma law the curve draws. The dark gaps between the grains fill in. Brightness is the mean intensity over 1 + 2 / sqrt(n) times its mean, the same for every LED, so the brightest grains stay full.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, log, cos, sin, atan2, PI, round } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
// The pupil: u runs across the 64 columns' frequencies and v down the 128
// rows', so a pupil RU samples wide in u and 2 RU tall in v makes round
// grains. Its largest box, RU_MAX either side.
const RU_MAX = 14, SU = 2 * RU_MAX + 1, SV = 4 * RU_MAX + 1, NS = SU * SV;
const LOOKS = 8;
// Brightness is intensity over TONE times the mean, so a third of the mean
// is the faintest LED that reads, and one LED in twenty is full. With n
// looks the scale is 1 + (TONE - 1) / sqrt(n), the mean plus about two
// standard deviations, which keeps the brightest LEDs full; it is the same
// for every LED, so the contrast is what it is.
const TONE = 3, SAT = 0.82;
// Each pupil shape holds SHAPE_T units and the last MORPH_T of them blend
// into the next. A unit is a second at Speed 2.
const SHAPE_T = 9, MORPH_T = 2.5;
// The spread of the diffuser's phase rates, radians a unit.
const BOIL = 0.9;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The colour of each of 256 phases at full value.
const LUT = new Float32Array(256 * 3);
for (let i = 0, c = [0, 0, 0]; i < 256; i++) {
  hsv(i / 256, SAT, 1, c);
  LUT.set(c, i * 3);
}

// A radix-2 FFT, in place along n entries of re/im spaced by stride.
function tables(n) {
  const rev = new Uint16Array(n), cs = new Float64Array(n / 2), sn = new Float64Array(n / 2);
  const bits = round(log(n) / log(2));
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  for (let k = 0; k < n / 2; k++) (cs[k] = cos((TAU * k) / n)), (sn[k] = sin((TAU * k) / n));
  return { n, rev, cs, sn };
}
const TX = tables(W), TY = tables(H);
function fft(re, im, off, stride, T) {
  const n = T.n, rev = T.rev;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = off + i * stride, b = off + j * stride;
      let t = re[a];
      re[a] = re[b];
      re[b] = t;
      t = im[a];
      im[a] = im[b];
      im[b] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let i = 0; i < n; i += size)
      for (let k = 0; k < half; k++) {
        const c = T.cs[k * step], s = T.sn[k * step];
        const a = off + (i + k) * stride, b = a + half * stride;
        const tr = re[b] * c - im[b] * s, ti = re[b] * s + im[b] * c;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
}

// The pupil shapes as signed distances in pupil units (a across, b down,
// the rim of the disc at 1): negative inside.
const len = (a, b) => sqrt(a * a + b * b);
const SHAPES = [
  (a, b) => len(a, b) - 1, // disc
  (a, b) => max(len(a, b) - 1, 0.6 - len(a, b)), // annulus
  (a, b) => min(len(a - 0.62, b), len(a + 0.62, b)) - 0.36, // two pinholes side by side
  (a, b) => max(abs(a), abs(b)) - 0.86, // square
  (a, b) => max(len(a, b) - 1, 0.84 - len(a, b)), // thin ring
  (a, b) => max(abs(a) - 0.24, abs(b) - 1), // slit, narrow across
  (a, b) => len(abs(a) - 0.5, abs(b) - 0.5) - 0.3, // four pinholes
  (a, b) => max(b - 0.5, max(-0.866 * a - 0.5 * b, 0.866 * a - 0.5 * b) - 0.5), // triangle
];
const NAMES = SHAPES.length;

// One look: a diffuser of its own, each pupil sample with a starting phase
// and a rate, and the field it makes.
function newLook() {
  const L = { p0: new Float32Array(NS), w: new Float32Array(NS), I: new Float32Array(N), zr: new Float32Array(N), zi: new Float32Array(N), at: -1 };
  for (let i = 0; i < NS; i++) {
    L.p0[i] = Math.random() * TAU;
    // A normal rate, by Box and Muller.
    L.w[i] = BOIL * sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());
  }
  return L;
}

export function setup(params) {
  const S = (params.s = {
    looks: [], re: new Float64Array(N), im: new Float64Array(N), P: new Float32Array(NS), sumP: 1,
    clock: 0, boil: 0, ru: 5, n: 1, hue: 0, next: 0,
    Iavg: new Float32Array(N), zr: new Float32Array(N), zi: new Float32Array(N), hist: new Float32Array(16), histOk: false,
  });
  for (let k = 0; k < LOOKS; k++) S.looks.push(newLook());
}

// The pupil's amplitude at every sample of the box, for radius ru and the
// shape schedule: soft-edged over one sample, so it changes smoothly with
// the knob and as one shape blends into the next.
function pupil(S) {
  const ru = S.ru, rv = 2 * ru, i0 = floor(S.clock / SHAPE_T), f = S.clock / SHAPE_T - i0;
  const A = SHAPES[i0 % NAMES], B = SHAPES[(i0 + 1) % NAMES];
  const m = smooth((f * SHAPE_T - (SHAPE_T - MORPH_T)) / MORPH_T);
  let sum = 0;
  for (let j = 0; j < SV; j++)
    for (let i = 0; i < SU; i++) {
      const a = (i - RU_MAX) / ru, b = (j - 2 * RU_MAX) / rv;
      const pa = cl(0.5 - A(a, b) * ru, 0, 1), pb = m > 0 ? cl(0.5 - B(a, b) * ru, 0, 1) : 0;
      const p = pa + (pb - pa) * m;
      S.P[j * SU + i] = p;
      sum += p * p;
    }
  S.sumP = max(sum, 1e-6);
}

// The field of one look: put P e^{i phi} on the frequency plane, transform
// the rows that hold any of it, then every column. I is |E|^2 over the sum
// of P^2, the mean intensity, so I has mean 1 whatever the pupil.
function field(S, L) {
  const re = S.re, im = S.im, P = S.P, t = S.boil;
  re.fill(0);
  im.fill(0);
  const rv = min(2 * RU_MAX, Math.ceil(2 * S.ru) + 1);
  for (let j = 0; j < SV; j++) {
    const v = j - 2 * RU_MAX;
    if (abs(v) > rv) continue;
    const row = ((v + H) % H) * W;
    for (let i = 0; i < SU; i++) {
      const s = j * SU + i, p = P[s];
      if (p <= 0) continue;
      const ph = L.p0[s] + L.w[s] * t, o = row + ((i - RU_MAX + W) % W);
      re[o] = p * cos(ph);
      im[o] = p * sin(ph);
    }
  }
  for (let v = -rv; v <= rv; v++) fft(re, im, ((v + H) % H) * W, 1, TX);
  for (let x = 0; x < W; x++) fft(re, im, x, W, TY);
  // zr + i zi is |E| E, the field weighted by its own amplitude: summed over
  // the looks it gives each LED the phase of whichever look is brightest there.
  const k = 1 / S.sumP, I = L.I;
  for (let p = 0; p < N; p++) {
    const q = (re[p] * re[p] + im[p] * im[p]) * k, a = sqrt(q * k);
    I[p] = q;
    L.zr[p] = re[p] * a;
    L.zi[p] = im[p] * a;
  }
  L.at = t;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 5, 1], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3);
  S.ru = cl(kv[2], 5, 14);
  const n = round(cl(kv[3], 1, LOOKS));
  const g = (d * speed) / 2;
  S.clock += g;
  S.boil += g;
  pupil(S);
  // Up to three looks are brought up to date each frame, in turn; a look
  // newly added is done at once.
  for (let k = 0; k < n; k++) if (S.looks[k].at < 0 || k >= S.n) field(S, S.looks[k]);
  S.n = n;
  for (let c = 0; c < min(n, 3); c++) {
    S.next = (S.next + 1) % n;
    field(S, S.looks[S.next]);
  }
  // The mean of the looks, its phase, and its histogram, eased over a few frames.
  const Ia = S.Iavg, Zr = S.zr, Zi = S.zi, hist = S.hist, cnt = new Float32Array(16);
  Ia.fill(0);
  Zr.fill(0);
  Zi.fill(0);
  for (let k = 0; k < n; k++) {
    const L = S.looks[k], I = L.I;
    for (let p = 0; p < N; p++) (Ia[p] += I[p] / n), (Zr[p] += L.zr[p]), (Zi[p] += L.zi[p]);
  }
  for (let p = 0; p < N; p++) {
    const b = floor(Ia[p] / BIN);
    if (b < 16) cnt[b]++;
  }
  const ease = S.histOk ? min(1, d * 6) : 1;
  for (let b = 0; b < 16; b++) hist[b] += (cnt[b] / (N * BIN) - hist[b]) * ease;
  S.histOk = true;
}

// The density of the mean of n exponentials with mean 1: a gamma law.
function gammaPdf(x, n) {
  let lf = 0;
  for (let k = 2; k < n; k++) lf += log(k);
  return x <= 0 ? (n === 1 ? 1 : 0) : exp(n * log(n) + (n - 1) * log(x) - n * x - lf);
}

// The window at the top: the pupil drawn at a fixed size, its rim at
// PR LEDs, over a dark disc of radius WR. The histogram along the bottom:
// 16 bins of the mean intensity, BIN times the mean wide, HB rows tall
// for a density of HD.
const WX = 31.5, WY = 11.5, WR = 11, PR = 8.5, HB = 22, HD = 1.25, BIN = 0.2;
const c3 = [0, 0, 0];
export function draw(display, params) {
  const S = params.s;
  if (!S || S.looks[0].at < 0) return;
  const n = S.n, Ia = S.Iavg, hue = S.hue, L0 = S.looks[0], tone = 1 + (TONE - 1) / sqrt(n);
  const i0 = floor(S.clock / SHAPE_T), f = S.clock / SHAPE_T - i0;
  const A = SHAPES[i0 % NAMES], B = SHAPES[(i0 + 1) % NAMES];
  const m = smooth((f * SHAPE_T - (SHAPE_T - MORPH_T)) / MORPH_T);
  const curve = new Float32Array(W);
  for (let x = 0; x < W; x++) curve[x] = H - 1 - (gammaPdf(((x + 0.5) * BIN) / 4, n) / HD) * HB;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const v = min(1, Ia[p] / tone), c = ((floor((atan2(S.zi[p], S.zr[p]) / TAU + hue) * 256) % 256) + 256) % 256;
      let r = v * LUT[c * 3], g = v * LUT[c * 3 + 1], b = v * LUT[c * 3 + 2];
      const dw = len(x - WX, y - WY);
      if (dw < WR + 1) {
        // The window: the field dims to a fifth, a thin rim, the pupil inside.
        const k = cl(WR + 0.5 - dw, 0, 1) * 0.8;
        (r *= 1 - k), (g *= 1 - k), (b *= 1 - k);
        const a = (x - WX) / PR, bb = (y - WY) / PR;
        const pa = cl(0.5 - A(a, bb) * PR, 0, 1), pb = cl(0.5 - B(a, bb) * PR, 0, 1), pu = pa + (pb - pa) * m;
        if (pu > 0) {
          // Tinted by the diffuser's phase at that sample of the first look.
          const si = cl(round(a * S.ru) + RU_MAX, 0, SU - 1), sj = cl(round(bb * 2 * S.ru) + 2 * RU_MAX, 0, SV - 1), s = sj * SU + si;
          hsv((L0.p0[s] + L0.w[s] * S.boil) / TAU + hue, 0.4, 0.95 * pu, c3);
          (r += c3[0]), (g += c3[1]), (b += c3[2]);
        }
        const ring = cl(1 - abs(dw - WR) * 1.5, 0, 1) * 0.35;
        (r += ring), (g += ring), (b += ring);
      }
      if (y >= H - HB - 2) {
        // The histogram: the field dims, the bars rise, the law is a line of dots.
        const k = cl((y - (H - HB - 2)) / 2, 0, 1) * 0.75;
        (r *= 1 - k), (g *= 1 - k), (b *= 1 - k);
        const bin = x >> 2, top = H - 1 - (S.hist[bin] / HD) * HB;
        if ((x & 3) !== 3 && y > top) {
          hsv(0.62 + hue - bin * 0.012, 0.45, 0.5, c3);
          (r += c3[0]), (g += c3[1]), (b += c3[2]);
        }
        const dc = abs(y - curve[x]), dn = x < W - 1 ? abs(curve[x + 1] - curve[x]) : 0;
        if (dc < max(0.8, dn + 0.3) && y < H) (r = 1), (g = 0.95), (b = 0.75);
      }
      display.setPixel(x, y, (255 * cl(r, 0, 1)) | 0, (255 * cl(g, 0, 1)) | 0, (255 * cl(b, 0, 1)) | 0);
    }
}
