// ===== Patternflow pattern =====
// Title:   Eye Diagram
// Family:  signal
// Idea:    A four-level eye diagram as a phosphor oscilloscope draws it: fifty fresh two-symbol traces of a random data stream a frame pile up into six dark eye openings joined by bright crossing knots, and noise, slow edges and jitter close them as the channel breathes.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the eye pattern of pulse transmission, symbol periods laid over one another on an oscilloscope (in use since the 1950s, from memory), inter-symbol interference and the pulse criterion of Harry Nyquist (1928, from memory), four-level pulse amplitude modulation as standardised in IEEE 802.3bs (2017, from memory), pattern round 201
// Round:   203
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Noise=0.2..4, Rise=-0.6..1, Jitter=0..0.18
//
// Knob 1: Hue. Turns the phosphor palette round the wheel; at 0 the haze is deep blue, the rails run cyan to orange and the densest spots go white. The palette also wanders a few degrees either side of the knob by itself.
// Knob 2: Noise. The rms noise on every trace as a share of the outer level, 0.013 at 0.2, 0.058 at 2 and 0.20 at 4, with the channel's own drift moving it by up to half again; at 4 the rails smear into one another and the eyes shrink to small dark pockets.
// Knob 3: Rise. How slowly an edge turns from one level to the next, a 10 to 90 per cent rise of 0.13 symbols at -0.6, 0.28 at 0 and 1.03 at 1; the slow end blurs every symbol into its neighbours until the sums of neighbouring symbols show as separate bright spots and the eyes shut.
// Knob 4: Jitter. The rms wobble of every symbol boundary, 0 to 0.18 of a symbol (6 LEDs at the top); at 0 the crossings are sharp knots, at 0.18 they are smeared into wide bars.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, log, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The normal CDF as a table, z from -4 to 4 in steps of 0.005.
const TAB = new Float32Array(1602);
(function () {
  const erf = (x) => {
    const s = x < 0 ? -1 : 1;
    x = abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
    return s * y;
  };
  for (let i = 0; i < 1602; i++) TAB[i] = 0.5 * (1 + erf((-4 + i * 0.005) / sqrt(2)));
})();
function Phi(z) {
  if (z <= -4) return 0;
  if (z >= 4) return 1;
  const f = (z + 4) * 200, i = floor(f);
  return TAB[i] + (TAB[i + 1] - TAB[i]) * (f - i);
}
const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(TAU * Math.random());

// Four levels. The panel's 64 columns are two symbol periods (32 LEDs each)
// and the symbol boundaries stand at x = 0, 32 and 64. The levels sit at
// -1, -1/3, 1/3 and 1 before the amplifier's soft compression pulls the
// outer ones in a tenth, which leaves the middle eye the biggest.
const LV = [-1, -1 / 3, 1 / 3, 1];
const SY = 58, MID = 64;
const NS = 8; // symbols -3 to 4: two periods and the neighbours whose edges still reach in
const TRACES_PER_SECOND = 1500;
const TAU_PERSIST = 1.1;
const GAMMA = 1.1;
// Each column of a trace adds span^EDGE in all, spread over the LEDs it crosses: 0 would leave a steep edge a faint wash, 1 draws it as bright as a rail.
const EDGE = 0.6;
// 5-tap Gaussian, sigma 0.85 LEDs.
const G5 = [0.029, 0.236, 0.471, 0.236, 0.029];

// Palette stops by density.
const STOPS = [
  [0.0, 0.0, 0.0, 0.0],
  [0.05, 0.0, 0.02, 0.28],
  [0.16, 0.02, 0.12, 0.8],
  [0.34, 0.0, 0.72, 0.95],
  [0.52, 0.1, 0.92, 0.4],
  [0.7, 0.98, 0.9, 0.12],
  [0.86, 1.0, 0.5, 0.06],
  [1.0, 1.0, 0.97, 0.85],
];

function buildLut(hue, lut) {
  // Rotate every colour about the grey axis by hue turns.
  const c = cos(TAU * hue), s = sin(TAU * hue), k = 1 / 3, r3 = sqrt(1 / 3);
  const m00 = c + (1 - c) * k, m01 = (1 - c) * k - r3 * s, m02 = (1 - c) * k + r3 * s;
  for (let i = 0; i < 256; i++) {
    const d = i / 255;
    let j = 0;
    while (j < STOPS.length - 2 && d > STOPS[j + 1][0]) j++;
    const a = STOPS[j], b = STOPS[j + 1], f = (d - a[0]) / (b[0] - a[0]);
    const r = a[1] + (b[1] - a[1]) * f, g = a[2] + (b[2] - a[2]) * f, bl = a[3] + (b[3] - a[3]) * f;
    let R = m00 * r + m01 * g + m02 * bl, G = m02 * r + m00 * g + m01 * bl, B = m01 * r + m02 * g + m00 * bl;
    // The rotation keeps each channel's total but not how bright the eye
    // finds it (deep blue turned to magenta floods the haze), so scale the
    // turned colour back to the luma it started with.
    const y0 = 0.299 * r + 0.587 * g + 0.114 * bl, y1 = 0.299 * R + 0.587 * G + 0.114 * B;
    const sc = y1 > 1e-4 ? y0 / y1 : 1;
    lut[i * 3] = cl(R * sc, 0, 1) * 255;
    lut[i * 3 + 1] = cl(G * sc, 0, 1) * 255;
    lut[i * 3 + 2] = cl(B * sc, 0, 1) * 255;
  }
}

export function setup(params) {
  params.s = {
    t: 0, hist: new Float32Array(N), tmp: new Float32Array(N), blur: new Float32Array(N), bins: new Int32Array(256),
    gain: 0, carry: 0, lut: new Float32Array(768), lutHue: -1, ready: false,
    ou: new Float32Array(15), p: { hue: 0, x0: 0, g: 1, dc: 0, lv: [0, 0, 0, 0], cum: [0.25, 0.5, 0.75, 1] }, ph: [0.7, 2.1, 4.0, 1.3, 5.2, 0.2, 3.3, 2.7, 4.6], burst: 0, nextBurst: 6 + Math.random() * 8,
    a: new Float32Array(NS), d: new Float32Array(NS), bnd: new Float32Array(NS), ys: new Float32Array(128),
  };
}

// A slow, never repeating wander: three sines at unrelated rates plus an
// Ornstein-Uhlenbeck drift, about +-1.
function wander(S, i, w1, w2, w3) {
  const t = S.t, p = S.ph;
  return 0.38 * sin(w1 * t + p[i * 3]) + 0.3 * sin(w2 * t + p[i * 3 + 1]) + 0.22 * sin(w3 * t + p[i * 3 + 2]) + S.ou[i];
}

function deposit(S, sn, sg, J) {
  const a = S.a, d = S.d, bnd = S.bnd, ys = S.ys, hist = S.hist;
  const P = S.p;
  for (let s = 0; s < NS; s++) {
    const u = Math.random(), q = u < P.cum[0] ? 0 : u < P.cum[1] ? 1 : u < P.cum[2] ? 2 : 3;
    a[s] = LV[q] + P.lv[q];
  }
  d[0] = 0;
  for (let s = 1; s < NS; s++) {
    d[s] = a[s] - a[s - 1];
    bnd[s] = s - 3 + J * gauss();
  }
  const common = sn * 0.5 * gauss(), single = sn * 0.85, inv = 1 / sg;
  for (let i = 0; i < 128; i++) {
    const t = (i + 0.5) / 64 - P.x0;
    let v = a[0];
    for (let s = 1; s < NS; s++) {
      const z = (t - bnd[s]) * inv;
      if (z > -4) v += d[s] * (z >= 4 ? 1 : Phi(z));
    }
    v += common + single * gauss() + P.dc;
    v = cl(v, -1.7, 1.7);
    ys[i] = MID - SY * P.g * (v - 0.1 * v * v * v);
  }
  let prev = ys[0];
  for (let c = 0; c < W; c++) {
    const y0 = ys[2 * c], y1 = ys[2 * c + 1];
    const lo = min(prev, y0, y1) - 0.5, hi = max(prev, y0, y1) + 0.5;
    prev = y1;
    const r0 = max(0, floor(lo)), r1 = min(H - 1, floor(hi)), inv2 = Math.pow(hi - lo, EDGE) / (hi - lo);
    for (let r = r0; r <= r1; r++) {
      const o = min(hi, r + 1) - max(lo, r);
      if (o > 0) hist[r * W + c] += o * inv2;
    }
  }
}

function advance(S, dt, k) {
  S.t += dt;
  // The channel breathes: the knob sets the middle, the wander and the
  // occasional burst of interference move it about.
  // Fifteen slow drifts, each an Ornstein-Uhlenbeck walk with its own memory
  // of 6 to 12 s and a spread of 0.5: three move the noise, the edge and the
  // jitter, the rest shift the eyes sideways, change the gain, skew each of
  // the four levels, move the baseline, tilt how often each level is sent and turn the palette a few degrees either way,
  // so no two minutes match.
  const ou = S.ou;
  for (let i = 0; i < 15; i++) {
    const tau = 6 + i * 0.5, kn = 1 - exp(-dt / tau);
    ou[i] += -ou[i] * kn + 0.5 * sqrt(2 * kn) * gauss();
  }
  const P = S.p;
  P.x0 = 0.18 * ou[3];
  P.hue = 0.13 * ou[14];
  P.g = 1 + 0.14 * ou[4];
  for (let q = 0; q < 4; q++) P.lv[q] = 0.12 * ou[5 + q];
  P.dc = 0.08 * ou[9];
  let tot = 0;
  for (let q = 0; q < 4; q++) tot += exp(0.45 * ou[10 + q]);
  for (let q = 0, c = 0; q < 4; q++) P.cum[q] = (c += exp(0.45 * ou[10 + q]) / tot);
  S.nextBurst -= dt;
  if (S.nextBurst <= 0) {
    S.burst = 1;
    S.nextBurst = 9 + Math.random() * 16;
  }
  S.burst *= exp(-dt / 1.3);
  const bs = S.burst * S.burst * (3 - 2 * S.burst);
  const noise = (0.012 + 0.0115 * k[1] * k[1]) * exp(0.5 * wander(S, 0, 0.23, 0.41, 0.097)) * (1 + 0.5 * bs);
  const rise = 0.28 * exp(1.3 * k[2]) * exp(0.7 * wander(S, 1, 0.19, 0.37, 0.13)) * (1 + 1.0 * bs);
  const jitter = max(0, k[3]) * exp(0.5 * wander(S, 2, 0.29, 0.17, 0.071));
  const sg = max(0.03, rise / 2.563);
  S.hist.forEach((_, i) => (S.hist[i] *= exp(-dt / TAU_PERSIST)));
  S.carry += TRACES_PER_SECOND * dt;
  const n = floor(S.carry);
  S.carry -= n;
  for (let i = 0; i < n; i++) deposit(S, noise, sg, jitter);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.k = k;
  if (!S.ready) {
    // Open with a screen that has been running a few persistence times.
    for (let i = 0; i < 100; i++) advance(S, 1 / 30, k);
    S.ready = true;
  }
  advance(S, dt, k);
}

function blurAndMap(S) {
  const { hist, tmp, blur } = S;
  // Horizontal then vertical 5-tap blur.
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let j = -2; j <= 2; j++) {
        const xx = x + j;
        if (xx >= 0 && xx < W) s += G5[j + 2] * hist[o + xx];
      }
      tmp[o + x] = s;
    }
  }
  let top = 1e-9;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let j = -2; j <= 2; j++) {
        const yy = y + j;
        if (yy >= 0 && yy < H) s += G5[j + 2] * tmp[yy * W + x];
      }
      blur[y * W + x] = s;
      if (s > top) top = s;
    }
  return top;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ready) return;
  const hue = S.k[0] + S.p.hue;
  if (hue !== S.lutHue) {
    buildLut(hue, S.lut);
    S.lutHue = hue;
  }
  const top = blurAndMap(S), blur = S.blur, bins = S.bins.fill(0);
  for (let i = 0; i < N; i++) bins[min(255, floor((blur[i] / top) * 256))]++;
  // The scale is set by the densest 1% of LEDs and follows slowly.
  let b = 255;
  for (let cnt = 0; b > 0 && (cnt += bins[b]) < N * 0.004; ) b--;
  const target = (top * (b + 1)) / 256;
  S.gain = S.gain > 0 ? S.gain + (target - S.gain) * 0.04 : target;
  const inv = 1 / S.gain, lut = S.lut;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = blur[y * W + x] * inv;
      const dd = u <= 0.02 ? 0 : min(1, Math.pow(u, GAMMA));
      const i = (dd * 255 + 0.5) | 0;
      display.setPixel(x, y, lut[i * 3], lut[i * 3 + 1], lut[i * 3 + 2]);
    }
}
