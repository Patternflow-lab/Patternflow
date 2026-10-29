// ===== Patternflow pattern =====
// Title:   Rose Criterion
// Family:  noise
// Idea:    A contrast-detail grid of fifty discs, five diameters across and ten contrasts down, is exposed photon by photon with Poisson counts and a little read noise, so the normalised picture starts as static, settles into grain and lets the discs rise out of it in order of contrast times diameter, while a faint line marks Rose's k = 5, the hyperbola C·d = const that sweeps from the top left corner toward the bottom right and stops where the dose runs out; then the exposure clears and builds again.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Rose's detection criterion k = C·sqrt(nA) (Albert Rose, "The sensitivity performance of the human eye on an absolute scale", J. Opt. Soc. Am. 38, 1948), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Exposure=0..1, Read noise=0..1
//
// Knob 1: Hue. The colour of the light: at 0 cyan grain with a gold k = 5 line, at 0.25 violet with a green line, at 0.5 coral with a blue line, at 0.75 lime with a magenta line.
// Knob 2: Speed. How fast each exposure builds: at 2 the dose comes in over 3 s, holds 1.2 s and clears; at 0.2 it comes in over 30 s, at 3 over 2 s. The photon flux is the dose over that time.
// Knob 3: Exposure. The dose a build stops at, in photons per LED: 25 at 0, 224 at 0.5, 2000 at 1. At 25 the k = 5 line stops at C·d = 1.15 with 7 of the 50 discs still in the grain; from 0.37 on every disc is seen, the last one (contrast 0.15, 9 LEDs) at 124 photons, and the rest of the dose only calms the grain.
// Knob 4: Read noise. Gaussian noise each channel adds every time it reads its LED, 1 photon rms at 0 and 9 at 1. It adds to the shot noise, so the grain coarsens and the k = 5 line, drawn with it counted in, slows: at 1 the first disc needs 8 photons instead of 1.3, and at 25 photons 24 discs stay hidden.

// Rose (1948): a disc of area A whose brightness differs by a fraction C
// from a background that has caught n photons per unit area is seen when
// k = C·sqrt(n·A), its excess count over the noise of the background count
// in the same area, passes about 5. With A = pi·d²/4 the threshold is
// C·d = 5 / sqrt(pi·n/4): at a given dose the seen and unseen discs of a
// contrast-detail grid are split by a hyperbola, which moves out as 1/sqrt(n).
//
// Here A is the disc's own LED count (97, 69, 37, 21 and 9 for diameters
// 11, 9, 7, 5 and 3) and n the photons per LED. Each LED keeps one count,
// read by each of its three channels with its own read noise sigma, so one
// read has variance n + sigma² and the line drawn is
// C·sqrt(A)·n / sqrt(n + sigma²) = 5.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, log, cos, sin, pow, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The grid: diameters across, contrasts down. Each disc is the LEDs whose
// centres lie within d/2 of the centre of the LED at (COLX, ROWY), so every
// disc in a column has the same shape and the same area.
const DIAM = [11, 9, 7, 5, 3];
const COLX = [6, 19, 32, 44, 57];
const ROWY = [6, 19, 32, 44, 57, 70, 83, 96, 108, 121];
const CONTRAST = ROWY.map((_, r) => 0.6 - 0.05 * r);
const K_ROSE = 5;
const CXS = COLX.map((x) => x + 0.5), CYS = ROWY.map((y) => y + 0.5);

// The display: the count normalised by what the background should have
// caught, so u = 1 on the background, then an exponential toe and a soft
// shoulder, 1 - exp(-a·exp(BETA·(u - 1))). Equal steps of u read as equal
// steps of brightness on the LEDs, and the background sits near L0 with
// grain on both sides of it instead of piling up at black.
const L0 = 13, BETA = 6.5;
// The gain runs out below this many expected photons, so the panel comes
// up from black instead of blowing up the first few counts.
const FLOOR = 3.5;
// How bright the k = 5 line is drawn.
const LINE = 150;
// The tone curve, tabulated over t = BETA·(u - 1) in steps of 1/128.
const T0 = -10, TS = 128, TN = 15 * TS;
const TONE = new Float32Array(TN + 1);
for (let i = 0; i <= TN; i++) TONE[i] = 1 - exp(-(L0 / 255) * exp(T0 + i / TS));

function poisson(l, gauss) {
  if (l <= 0) return 0;
  if (l > 15) return max(0, round(l + sqrt(l) * gauss()));
  const u = Math.random();
  let k = 0, p = exp(-l), s = p;
  while (u > s && k < 60) {
    k++;
    p *= l / k;
    s += p;
  }
  return k;
}

export function setup(params) {
  const cidx = new Uint8Array(W * H);
  const area = DIAM.map(() => 0);
  DIAM.forEach((d, c) => {
    const r2 = (d / 2) * (d / 2), R = d >> 1;
    for (let i = -R; i <= R; i++)
      for (let j = -R; j <= R; j++) {
        if (i * i + j * j > r2) continue;
        area[c]++;
        ROWY.forEach((y, r) => (cidx[(y + j) * W + COLX[c] + i] = r + 1));
      }
  });
  // Standard normal deviates, drawn once and picked at random at every read.
  const norm = new Float32Array(4096);
  for (let i = 0; i < 4096; i += 2) {
    const a = sqrt(-2 * log(1 - Math.random())), b = 2 * PI * Math.random();
    norm[i] = a * cos(b);
    norm[i + 1] = a * sin(b);
  }
  params.s = {
    cidx, deff: area.map((a) => sqrt((4 * a) / PI)),
    gauss: () => norm[(Math.random() * 4096) | 0],
    count: new Float32Array(W * H), f: new Float32Array(W * H), dx: new Float32Array(W),
    n: 0, hold: 0, stop: 25, sr: 1, hue: 0, lam: new Float32Array(11),
    w: new Float32Array(3), lc: new Float32Array(3),
  };
  return params.s;
}

// The k = 5 threshold on C·d at dose n and read noise sr.
const lineK = (n, sr) => (n > 0 ? (K_ROSE * sqrt(n + sr * sr)) / (n * sqrt(PI / 4)) : 1e9);

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1] ?? 2, 0.2, 3);
  S.stop = 25 * pow(80, cl(kv[2] || 0, 0, 1));
  const rn = cl(kv[3] ?? 0.06, 0, 1);
  S.sr = 1 + 8 * rn * rn;

  if (S.n >= S.stop) {
    S.hold += d * speed;
    if (S.hold > 2.4) {
      S.n = 0;
      S.hold = 0;
      S.count.fill(0);
    }
    return;
  }
  // Constant flux: the dose comes in over 6/speed seconds. A disc of
  // contrast C catches 1 + C times the background's photons.
  S.hold = 0;
  const dn = min(S.stop - S.n, (S.stop * speed * d) / 6);
  S.n += dn;
  for (let k = 0; k <= 10; k++) S.lam[k] = dn * (k ? 1 + CONTRAST[k - 1] : 1);
  const cnt = S.count, ci = S.cidx, lam = S.lam, g = S.gauss;
  for (let i = 0; i < W * H; i++) cnt[i] += poisson(lam[ci[i]], g);
}

// Piecewise linear through the grid's centres, carried on past the ends.
function interp(xs, ys, v) {
  let i = 0;
  while (i < xs.length - 2 && v > xs[i + 1]) i++;
  return ys[i] + ((v - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const cnt = S.count, sr = S.sr, gauss = S.gauss, w = hsv(0.5 + S.hue, 0.55, 1, S.w);
  const w0 = 255 * w[0], w1 = 255 * w[1], w2 = 255 * w[2];
  // One read: t = BETA·(u - 1) as a row of the tone table.
  const sc = (BETA * TS) / max(S.n, FLOOR), off = (-BETA - T0) * TS, rs = sr * sc;
  const tone = (c) => {
    const t = (c + rs * gauss() + off) | 0;
    return TONE[t < 0 ? 0 : t > TN ? TN : t];
  };

  // The line: where C(y)·d(x) crosses the k = 5 threshold, drawn on the seen side.
  const K = lineK(S.n, sr), f = S.f, dx = S.dx;
  for (let x = 0; x < W; x++) dx[x] = max(0.3, interp(CXS, S.deff, x + 0.5));
  for (let y = 0; y < H; y++) {
    const C = max(0.005, interp(CYS, CONTRAST, y + 0.5));
    for (let x = 0; x < W; x++) f[y * W + x] = C * dx[x] - K;
  }
  const lc = hsv(S.hue + 0.13, 0.75, 1, S.lc);
  const l0 = lc[0] * LINE, l1 = lc[1] * LINE, l2 = lc[2] * LINE;

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, c = cnt[i] * sc;
      // One count per LED, read once by each of its three channels.
      let r = w0 * tone(c), g = w1 * tone(c), b = w2 * tone(c);
      const v = f[i];
      if (v >= 0 && ((x > 0 && f[i - 1] < 0) || (x < W - 1 && f[i + 1] < 0) || (y > 0 && f[i - W] < 0) || (y < H - 1 && f[i + W] < 0))) {
        r = max(r, l0);
        g = max(g, l1);
        b = max(b, l2);
      }
      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
}
