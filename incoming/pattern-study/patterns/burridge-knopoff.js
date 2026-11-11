// ===== Patternflow pattern =====
// Title:   Burridge-Knopoff
// Family:  physics
// Idea:    Every LED is a block held on a fault by velocity-weakening friction, tied to its four neighbours by springs and pulled by a creeping plate, so stress loads the whole panel until a patch lets go and its slip runs across the lattice as an elastic rupture front with a fading wake.
// Author:  patternflow-lab
// Date:    2026-11-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the spring-block model of an earthquake fault, Robert Burridge and Leon Knopoff, "Model and theoretical seismicity" (1967), on a two-dimensional lattice with the velocity-weakening friction law of Jean Carlson and James Langer, "Mechanical model of an earthquake fault" (1989)
// Round:   129
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.8..3, Scale=-1..1, Weakening=-1..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel.
// Knob 2: Speed. How fast the plate creeps and the waves run.
// Knob 3: Scale. Spring stiffness between blocks over the plate's.
// Knob 4: Weakening. How far friction drops once a block slips.

const W = 64, H = 128, N = W * H;
const { floor, sqrt, sin, cos, exp, max, min, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const OPEN = [0, 2, 0, 0.06];

const RATE = 10; // model time units a panel second at Speed 1, and Kc = 16
const LOAD = 0.04; // stress a panel second at Speed 1
const VC = 0.08; // slip speed that halves friction
const PREROLL = 500; // model time units run before the first frame
const SPREAD = 0.2; // spread of the thresholds
const CORR = 4; // box radius that smooths the threshold map, LEDs
const TRAIL = 0.35; // seconds the slip wake takes to fall by e
const DRIFT = 0.0123; // radians a panel second that the threshold map turns between two maps
const KSPAN = 0.7; // Scale's reach: Kc = KC0 exp(KSPAN Scale)
const KC0 = 10; // Kc at Scale 0, spring stiffness between blocks over the plate's
const HB = 0.1; // how far the ramp's hue breathes, in turns of the wheel

function setup(params) {
  const f = () => new Float64Array(N);
  const S = { y: f(), v: f(), dd: f(), thr: f(), ga: f(), gb: f(), f: f(), mx: f(), tr: f(), tm: f(), warm: false, nf: 0, lo: 0, hi: 0.4, tt: 0, kc: 16, sg: 0.35, t: 0 };
  params.s = S;
  return S;
}

// Smooth random map with unit spread: white noise through three box blurs on the torus.
function smoothMap(out, r, tm) {
  for (let p = 0; p < N; p++) out[p] = Math.random() - 0.5;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += out[y * W + ((x + d + W) % W)];
        tm[y * W + x] = s / (2 * r + 1);
      }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        for (let d = -r; d <= r; d++) s += tm[((y + d + H) % H) * W + x];
        out[y * W + x] = s / (2 * r + 1);
      }
  }
  let m = 0, q = 0;
  for (let p = 0; p < N; p++) m += out[p];
  m /= N;
  for (let p = 0; p < N; p++) q += (out[p] - m) * (out[p] - m);
  q = sqrt(q / N);
  for (let p = 0; p < N; p++) out[p] = (out[p] - m) / q;
}

// One step of dt model time units, semi-implicit Euler. y is the block's place against the plate, so a stuck block's y falls at the plate speed V.
// Force on a block: Kc (sum of neighbours - 4 y) - y. It slips when that passes its threshold and then feels thr (1 - sg) / (1 + v / VC).
function sub(S, dt, V) {
  const { y, v, thr, f, mx } = S, kc = S.kc, sg = S.sg;
  for (let r = 0; r < H; r++) {
    const o = r * W, up = ((r + H - 1) % H) * W, dn = ((r + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const p = o + x, l = o + (x === 0 ? W - 1 : x - 1), rt = o + (x === W - 1 ? 0 : x + 1);
      f[p] = kc * (y[l] + y[rt] + y[up + x] + y[dn + x] - 4 * y[p]) - y[p];
    }
  }
  for (let p = 0; p < N; p++) {
    let vi = v[p];
    const fi = f[p], th = thr[p];
    if (vi > 0) {
      vi += (fi - (th * (1 - sg)) / (1 + vi / VC)) * dt;
      if (vi < 0) vi = 0;
    } else if (fi > th) vi = (fi - th * (1 - sg)) * dt;
    v[p] = vi;
    y[p] += (vi - V) * dt;
    if (vi > mx[p]) mx[p] = vi;
  }
}

function modulation(t) {
  return 1 + 0.35 * sin(0.113 * t + 1.3) + 0.25 * sin(0.0711 * t + 4.1) + 0.15 * sin(0.2917 * t);
}

function advance(S, ft, k) {
  const speed = cl(k[1], 0.8, 3), kc = KC0 * exp(KSPAN * cl(k[2], -1, 1));
  S.kc = kc;
  S.sg = 0.3 + 0.25 * cl(k[3], -1, 1);
  // the threshold map turns slowly between two independent maps, so the barriers wear and heal; wider spread where the springs are stiffer
  const ca = cos(DRIFT * S.t), sa = sin(DRIFT * S.t), sp = SPREAD * sqrt(kc / KC0);
  for (let p = 0; p < N; p++) S.thr[p] = 1 + sp * (ca * S.ga[p] + sa * S.gb[p]);
  const r0 = (RATE * 4) / sqrt(kc), units = ft * speed * r0, V = (LOAD / r0) * modulation(S.t);
  S.t += ft * speed;
  const dtmax = min(0.1, 1 / sqrt(1 + 8 * kc)), n = max(1, Math.ceil(units / dtmax - 1e-9));
  S.mx.fill(0);
  for (let i = 0; i < n; i++) sub(S, units / n, V);
  const dec = exp(-ft / TRAIL);
  for (let p = 0; p < N; p++) S.tr[p] = max(S.tr[p] * dec, cl(S.mx[p] / (3 * VC), 0, 1));
}

export function update(dt, input, params) {
  const S = params.s || setup(params), k = input.knobValues || OPEN;
  S.hue = k[0];
  if (!S.warm) {
    S.warm = true;
    smoothMap(S.ga, CORR, S.tm);
    smoothMap(S.gb, CORR, S.tm);
    const sm = new Float64Array(N);
    smoothMap(sm, 4, S.tm);
    for (let p = 0; p < N; p++) {
      S.thr[p] = 1 + SPREAD * S.ga[p];
      S.y[p] = -(0.55 + 0.25 * sm[p]) * S.thr[p];
    }
    S.kc = KC0 * exp(KSPAN * cl(k[2], -1, 1));
    S.sg = 0.3 + 0.25 * cl(k[3], -1, 1);
    const dtp = min(0.1, 1 / sqrt(1 + 8 * S.kc));
    const n = Math.ceil(PREROLL / dtp);
    for (let i = 0; i < n; i++) sub(S, dtp, (LOAD / ((RATE * 4) / sqrt(S.kc))) * 1);
    S.mx.fill(0);
  }
  advance(S, cl(dt || 0, 0, 0.1), k);
}

// ---- colour ---------------------------------------------------------------------------------
function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// 1-2-1 blur of the deficit on the torus, in two passes through tm
function blur(a, tm) {
  for (let y = 0; y < H; y++) {
    const o = y * W;
    for (let x = 0; x < W; x++) tm[o + x] = 0.25 * a[o + (x === 0 ? W - 1 : x - 1)] + 0.5 * a[o + x] + 0.25 * a[o + (x === W - 1 ? 0 : x + 1)];
  }
  for (let y = 0; y < H; y++) {
    const o = y * W, om = ((y + H - 1) % H) * W, op = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) a[o + x] = 0.25 * tm[om + x] + 0.5 * tm[o + x] + 0.25 * tm[op + x];
  }
}
const LUT = new Float32Array(256 * 3), GL = new Float32Array(256 * 3);
const sorted = new Float64Array(512);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.warm) return;
  const { tr, dd } = S, h0 = S.hue + 0.68 + HB * (0.6 * sin(0.103 * S.t + 0.7) + 0.4 * sin(0.0617 * S.t + 2.9));
  // slow percentiles of the slip deficit set the ramp's ends, so the picture keeps its range at every knob
  for (let p = 0; p < N; p++) dd[p] = -S.y[p];
  blur(dd, S.tm);
  for (let i = 0; i < 512; i++) sorted[i] = dd[(i * 16 + ((S.nf * 7) % 16)) % N];
  sorted.sort();
  const lo = sorted[10], hi = sorted[501], a = S.nf === 0 ? 1 : 0.02;
  S.lo += (lo - S.lo) * a;
  S.hi += (hi - S.hi) * a;
  S.nf++;
  for (let i = 0; i < 256; i++) {
    const s = i / 255;
    hsv(h0 + 0.4 * s, 0.9 - 0.15 * s, 0.22 + 0.7 * Math.pow(s, 0.9), LUT, i * 3);
    hsv(h0 - 0.1 + 0.05 * s, 0.6 - 0.58 * s * s, 1, GL, i * 3);
  }
  const sc = 1 / Math.max(0.15, S.hi - S.lo);
  for (let p = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++) {
      const s = cl((dd[p] - S.lo) * sc, 0, 1), o = ((s * 255) | 0) * 3, g = tr[p], go = ((g * 255) | 0) * 3, m = Math.pow(g, 0.8) * 0.95;
      const r = 255 * LUT[o], gg = 255 * LUT[o + 1], b = 255 * LUT[o + 2];
      display.setPixel(x, y, r + (255 * GL[go] - r) * m, gg + (255 * GL[go + 1] - gg) * m, b + (255 * GL[go + 2] - b) * m);
    }
}
