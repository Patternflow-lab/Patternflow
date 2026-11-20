// ===== Patternflow pattern =====
// Title:   Single Electrons
// Family:  quantum
// Idea:    Electrons land one at a time on a phosphor screen, each hit a white flash that cools to a violet-blue afterglow, and out of a scatter that looks random the bright and dark bands of a double slit slowly pile up, until the knob that watches which slit each one took washes them out.
// Author:  patternflow-lab
// Date:    2026-11-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Thomas Young's two-slit experiment with light (1801), electron diffraction (Clinton Davisson and Lester Germer, 1927), the double slit with electrons (Claus Jonsson, 1961), the film of single electrons building up the fringes (Akira Tonomura and colleagues, 1989, from memory), pattern round 203
// Round:   203
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Rate=0.2..4, Gap=-1..1, Watching=0..1
//
// Knob 1: Hue. Turns the phosphor round the wheel from the violet-blue it opens on; the flash of each hit stays ice white.
// Knob 2: Rate. How many electrons land a second: about 2 at the bottom, where every flash can be followed alone, 85 where it opens, and 260 at the top, where the screen fills within seconds.
// Knob 3: Gap. How far apart the two slits are: close together the fringes are wide, 16 LEDs from bright band to bright band at the bottom, 10 where it opens, and 6.4 at the top; hits that land after a turn follow the new spacing and the old ones fade out behind them.
// Knob 4: Watching. How well something knows which slit each electron took: at 0 nobody looks and the bands are sharp, and by 1 the bands are gone and only the broad glow of two single slits is left.

const W = 64;
const H = 128;
const N = W * H;
const { floor, sqrt, sin, cos, exp, log, pow, PI, min } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// The afterglow is two decaying stores, as a real phosphor's is: a short
// one that lets a turned knob show within a few seconds and a long one
// that holds the evidence the fringes are made of.
const TAU_S = 2.6;
const TAU_L = 24;
const WEIGHT_S = 0.3;
const WEIGHT_L = 0.7;
// The glow is read through a few LEDs of vertical blur, the way a long phosphor
// spreads along the slits' own direction: it does nothing to a vertical band
// and averages the scatter along it, so the bands read from a few hundred hits.
const BLUR = [1, 3, 6, 8, 6, 3, 1];
const TAU_FLASH = 0.2;
const SIGMA = 1.1;
const RADIUS = 3;
const PREROLL = 28;

const gauss = () => sqrt(-2 * log(1 - Math.random())) * cos(2 * PI * Math.random());
function poisson(m) {
  const L = exp(-m);
  let k = 0;
  for (let p = Math.random(); p > L; p *= Math.random()) k++;
  return k;
}

export function setup(params) {
  params.s = {
    t: 0, first: true, walk: 0, gain: 2, c: [0, 0, 0],
    accS: new Float32Array(N), accL: new Float32Array(N), fl: new Float32Array(N), D: new Float32Array(N), T: new Float32Array(N),
    hist: new Int32Array(128),
  };
}

// The setup drifts slowly and on frequencies that share no factor, so the
// screen never comes back to an earlier state. It moves a fraction of a
// fringe over the afterglow's life, which is what lets the bands pile up.
function conditions(S, k) {
  const t = S.t;
  // The beam's wavelength breathes a little; fringe spacing and the width of
  // the single-slit envelope both scale with it.
  const wl = 1 + 0.035 * (sin(0.0213 * t + 1.3) + 0.6 * sin(0.0097 * t + 4.1));
  const P = 10 * pow(2, -0.65 * k[2]) * wl;
  const E = 38 * wl;
  const V = cl((1 - k[3]) * (1 + 0.04 * sin(0.173 * t + 0.5)), 0, 1);
  const x0 = 32 + 3.4 * sin(0.0231 * t + 0.7) + 2.2 * sin(0.0137 * t + 2.2) + S.walk;
  const tilt = 0.016 * sin(0.0173 * t + 0.4) + 0.01 * sin(0.0097 * t + 3.1);
  const y0 = 64 + 9 * sin(0.053 * t + 1);
  const sy = 54 * (1 + 0.08 * sin(0.031 * t + 2));
  const clump = exp(0.4 * (0.6 * sin(0.37 * t + 1) + 0.4 * sin(0.153 * t + 2.5) + 0.3 * sin(0.0617 * t)));
  const rate = 28 * pow(cl(k[1], 0.2, 4), 1.6) * clump;
  return { P, E, V, x0, tilt, y0, sy, rate };
}

// One electron lands where the double-slit pattern puts it: along x with
// probability (1 + V cos(2 pi u / P)) times the single-slit envelope
// sinc^2(pi u / E), u the distance from the fringe centre at that height,
// and along y by the broad beam.
function land(S, c, w) {
  let y = 0;
  for (let i = 0; i < 20; i++) {
    y = c.y0 + c.sy * gauss();
    if (y >= 0 && y < H) break;
    y = cl(y, 0, H - 1);
  }
  const xc = c.x0 + c.tilt * (y - 64);
  let x = xc;
  for (let i = 0; i < 80; i++) {
    const cx = Math.random() * W, u = cx - xc, e = u === 0 ? 1 : sin((PI * u) / c.E) / ((PI * u) / c.E);
    const p = (1 + c.V * cos((2 * PI * u) / c.P)) / (1 + c.V) * (0.2 + 0.8 * e * e);
    if (Math.random() < p) {
      x = cx;
      break;
    }
  }
  // A soft blob a few LEDs wide, never a single LED.
  const ix = floor(x), iy = floor(y), two = 2 * SIGMA * SIGMA;
  let n = 0;
  for (let dy = -RADIUS; dy <= RADIUS; dy++) {
    const py = iy + dy;
    for (let dx = -RADIUS; dx <= RADIUS; dx++, n++) {
      const px = ix + dx;
      const g = exp(-((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2) / two);
      w[n] = px < 0 || px >= W || py < 0 || py >= H || g < 0.02 ? 0 : g;
    }
  }
  n = 0;
  for (let dy = -RADIUS; dy <= RADIUS; dy++)
    for (let dx = -RADIUS; dx <= RADIUS; dx++, n++) {
      if (!w[n]) continue;
      const i = (iy + dy) * W + ix + dx;
      S.accS[i] += w[n];
      S.accL[i] += w[n];
      S.fl[i] += w[n];
    }
}

const BLOB = new Float32Array((2 * RADIUS + 1) ** 2);

function advance(S, dt, k) {
  S.t += dt;
  S.walk = cl(S.walk - S.walk * 0.05 * dt + 0.3 * sqrt(dt) * gauss(), -3, 3);
  const c = conditions(S, k);
  const ds = exp(-dt / TAU_S), dl = exp(-dt / TAU_L), df = exp(-dt / TAU_FLASH);
  const { accS, accL, fl } = S;
  for (let i = 0; i < N; i++) {
    accS[i] *= ds;
    accL[i] *= dl;
    fl[i] *= df;
  }
  const n = poisson(c.rate * dt);
  for (let i = 0; i < n; i++) land(S, c, BLOB);
}

// The screen's brightness is the afterglow's density, 1 - exp(-gain D),
// with the gain eased toward whatever keeps the busiest 3% of the panel
// near full, so a thin trickle and a flood both leave the fringes readable.
function density(S) {
  const { accS, accL, D, hist, T } = S;
  let top = 1e-6;
  for (let i = 0; i < N; i++) T[i] = WEIGHT_S * accS[i] + WEIGHT_L * accL[i];
  const R = BLUR.length >> 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0, wsum = 0;
      for (let d = -R; d <= R; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= H) continue;
        sum += BLUR[d + R] * T[yy * W + x];
        wsum += BLUR[d + R];
      }
      const v = sum / wsum;
      D[y * W + x] = v;
      if (v > top) top = v;
    }
  hist.fill(0);
  for (let i = 0; i < N; i++) hist[min(127, floor((D[i] / top) * 128))]++;
  let b = 127;
  for (let cnt = 0; b > 0 && (cnt += hist[b]) < N * 0.03; ) b--;
  const p97 = (top * (b + 1)) / 128;
  return cl(1.7 / p97, 0.3, 2.6);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  if (S.first) {
    // Open as if the screen had been running for a while.
    for (let t = 0; t < PREROLL; t += 0.1) advance(S, 0.1, k);
    S.gain = density(S);
    S.first = false;
  }
  advance(S, dt, k);
  S.k = k;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.first) return;
  const k = S.k || [0, 2, 0, 0.06];
  const g0 = density(S);
  S.gain += (g0 - S.gain) * 0.04;
  const g = S.gain, c = S.c, D = S.D, fl = S.fl;
  const hue = 0.71 + k[0];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = 1 - exp(-g * D[i]);
      hsv(hue - 0.05 * v, 0.92 - 0.6 * v * v, v ** 1.15, c);
      // The flash of a hit that has just landed.
      const f = min(1, fl[i]) * 0.85;
      display.setPixel(x, y, 255 * (c[0] + (0.9 - c[0]) * f), 255 * (c[1] + (0.96 - c[1]) * f), 255 * (c[2] + (1 - c[2]) * f));
    }
}
