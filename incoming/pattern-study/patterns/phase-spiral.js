// ===== Patternflow pattern =====
// Title:   Phase Spiral
// Family:  sim
// Idea:    Three thousand parallel sheets of mass fall through each other along a line, each pulled by a force that only changes when two of them cross, and their phase portrait, position across the panel and velocity up it, winds a cold strip into a two-armed spiral whose turns multiply and thin round a settling white core, every sheet coloured by where it began on the strip.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: one-dimensional self-gravitating sheet model (Michel Hénon, 1964; Frank Hohl and Marc Feix, 1967), violent relaxation (Donald Lynden-Bell, 1967), pattern round 60
// Round:   60
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spread=0.1..1.2, Lumps=0..1
//
// Knob 1: Hue. Turns the ramp along the strip round the wheel. At 0 the sheet that starts at the left end is azure and the one at the right end rose, through blue, violet and magenta between; at 0.25 magenta through red to yellow, at 0.5 orange through yellow to sea green, at 0.75 green through cyan to blue. Where many sheets share an LED the colour goes toward white, so the core is pale at every setting.
// Knob 2: Speed. Sheet time per second, 1.6 x Speed: 3.2 at 2, where the cold strip falls to the middle in 0.49 s and, once it has settled, the sheet from the end of the strip goes round in 2.3 s and one from a tenth or a quarter of the way along in 1 s, and that difference is what winds the spiral; 0.32 at 0.2 and 4.8 at 3. A fresh strip starts every 72 units of sheet time, 22.5 s at 2 (the first one after 17.5 s, as it opens 16 units in).
// Knob 3: Spread. Half the height of the starting strip, its velocities spread evenly over plus and minus this, in units where the strip is 2 wide and a sheet with all the others on one side feels an acceleration of 1. Twice the kinetic energy over the potential starts at Spread squared: 0.01 at the opening 0.1, a cold collapse that winds the thinnest spiral; 1 at Spread 1, a waterbag in virial balance that only rocks and sheds two arms from its corners; 1.44 at 1.2, a hot one that swells first. A new value starts a fresh strip.
// Knob 4: Lumps. Bunches the strip's sheets into four lumps, moving each by 0.95 x Lumps x sin(4 pi u) / (4 pi) from its even place u: at 1 the strip is 39 times as dense in the middle of a lump as halfway between two. Each lump falls in on itself first and spins up a little spiral, and the four then fall together and merge, which keeps the cloud ringing: the virial ratio still swings between 0.3 and 3 after 36 units, where a smooth strip has settled within 25 percent of 1 by 16. It opens at 0.06, almost smooth. A new value starts a fresh strip.
// Buttons: K1 tap starts a fresh strip at once, falling from rest; the old spiral fades out over 0.9 s at Speed 2.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, exp, round, random, sin, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Units: the starting strip runs from x = -1 to 1, and a sheet with every
// other sheet on one side is pulled toward them at 1. Inside a uniform
// strip the pull is -x, so a cold strip would swing as a pendulum of period
// 2 pi and fall to a point at pi / 2; any spread of velocities or of
// density breaks that up. Phase space (x, v) is drawn with x across the
// panel, SX LEDs to a unit, and v up it, SV LEDs to a unit.
const N = 3072;
const XC = 32, VC = 64, SX = 22, SV = 44;
const DT = 0.04, RATE = 1.6, PRE = 16, CYCLE = 72, FADE = 3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    x: new Float64Array(N), xs: new Float64Array(N), v: new Float64Array(N), a: new Float64Array(N), f: new Float32Array(N),
    ord: new Int32Array(N), bin: new Int32Array(N), cnt: new Int32Array(N + 1),
    px: new Float32Array(N), py: new Float32Array(N), fresh: true, used: [0.1, 0.06],
    D: new Float32Array(NP), F: new Float32Array(NP), rgb: new Float32Array(NP * 3), old: new Float32Array(NP * 3),
    lut: new Float32Array(256 * 3), t: 0, fade: 0, started: false, hue: 0, speed: 2, spread: 0.1, lumps: 0.06,
  };
}

// The pull on every sheet, from its rank. A counting sort into N bins
// across the sheets' present extent puts them nearly in order, and an
// insertion sort mends the few that share a bin, so the order is exact and
// the cost does not grow with the number of crossings, about N^2 every
// period. A sheet with k sheets on its left and N - 1 - k on its right is
// pulled toward the heavier side by (N - 1 - 2k) / N, constant until the
// next crossing: between crossings every sheet flies a parabola.
function ranks(S, lo, hi) {
  const { x, xs, a, ord, bin, cnt } = S, sc = (N - 1) / (hi - lo + 1e-12);
  cnt.fill(0);
  for (let i = 0; i < N; i++) {
    const b = ((x[i] - lo) * sc) | 0;
    bin[i] = b;
    cnt[b + 1]++;
  }
  for (let b = 1; b <= N; b++) cnt[b] += cnt[b - 1];
  for (let i = 0; i < N; i++) {
    const k = cnt[bin[i]]++;
    ord[k] = i;
    xs[k] = x[i];
  }
  for (let k = 1; k < N; k++) {
    const xk = xs[k];
    if (xs[k - 1] <= xk) continue;
    const j = ord[k];
    let m = k - 1;
    while (m >= 0 && xs[m] > xk) (xs[m + 1] = xs[m]), (ord[m + 1] = ord[m]), m--;
    (xs[m + 1] = xk), (ord[m + 1] = j);
  }
  for (let k = 0; k < N; k++) a[ord[k]] = (N - 1 - 2 * k) / N;
}

// A leapfrog step: kick with the pull of the last order, drift, sort again.
// Across one cycle from rest at DT the total energy moved by 1 part in
// 10^4; the coarser opening run, 0.05 through the first collapse and 0.1
// after, lands within 0.4 percent of it.
function step(S, dt) {
  const { x, v, a } = S;
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i < N; i++) {
    v[i] += dt * a[i];
    const xi = (x[i] += dt * v[i]);
    if (xi < lo) lo = xi;
    if (xi > hi) hi = xi;
  }
  ranks(S, lo, hi);
  S.t += dt;
}

// A fresh strip, a waterbag: the sheets evenly along x, bunched into four
// lumps by Lumps, and their velocities spread evenly over +-Spread by the
// golden-ratio sequence, which fills the rectangle without the clumps and
// holes of random draws. f is a sheet's place along the strip, 0 at the
// left end and 1 at the right, and picks its colour for good.
function fresh(S) {
  const { x, v, f } = S, A = 0.95 * S.lumps, V0 = S.spread, r0 = random();
  for (let i = 0; i < N; i++) {
    const q = (i + 0.5) / N, u = 2 * q - 1;
    f[i] = q;
    x[i] = u + (A / (4 * PI)) * sin(4 * PI * u);
    v[i] = V0 * (2 * ((i * 0.6180339887 + r0) % 1) - 1);
  }
  S.t = 0;
  S.used = [V0, S.lumps];
  ranks(S, -1, 1);
  S.fresh = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0.1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.spread = cl(k[2], 0.1, 1.2);
  S.lumps = cl(k[3], 0, 1);
  // The first strip opens 16 units in, past the violent part of its
  // relaxation, so the spiral has two turns by 2 s; the later ones start
  // from rest and show the collapse.
  if (!S.started) {
    fresh(S);
    while (S.t < PRE) step(S, S.t < 3 ? 0.05 : 0.1);
    S.started = true;
  }
  const moved = abs(S.spread - S.used[0]) > 0.01 || abs(S.lumps - S.used[1]) > 0.01;
  if (S.t > CYCLE || moved || (input.btnPressed && input.btnPressed[0])) {
    S.old.set(S.rgb);
    S.fade = 1;
    fresh(S);
  }
  const h = d * S.speed * RATE;
  S.fade = max(0, S.fade - h / FADE);
  const n = Math.ceil(h / DT - 1e-9);
  for (let i = 0; i < n; i++) step(S, h / n);
}

// Brightness and the share of white for a density d, the number of
// sheets on an LED, in steps of 1/32.
const NB = 512, BR = new Float32Array(NB), WH = new Float32Array(NB);
for (let e = 0; e < NB; e++) (BR[e] = (1 - exp(-(e + 0.5) / 32 / 0.35)) * 255), (WH[e] = cl(((e + 0.5) / 32 - 2) / 6, 0, 0.7));

function splat(D, F, px, py, w, f) {
  const ix = floor(px), iy = floor(py);
  if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return;
  const tx = px - ix, ty = py - iy, p = iy * W + ix;
  const w00 = w * (1 - tx) * (1 - ty), w10 = w * tx * (1 - ty), w01 = w * (1 - tx) * ty, w11 = w * tx * ty;
  D[p] += w00;
  D[p + 1] += w10;
  D[p + W] += w01;
  D[p + W + 1] += w11;
  F[p] += w00 * f;
  F[p + 1] += w10 * f;
  F[p + W] += w01 * f;
  F[p + W + 1] += w11 * f;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { x, v, f, D, F, rgb, old, lut, px, py } = S, fd = S.fade;
  for (let i = 0; i < 256; i++) hsv(S.hue + 0.55 + 0.4 * (i / 255), 0.8, 1, lut, i * 3);
  D.fill(0);
  F.fill(0);
  // Each sheet is laid down bilinearly where it is now and, if it moved
  // more than 0.8 LED since the last frame, halfway back as well, so an
  // arm sliding along itself reads as a line and not a row of dots. An LED
  // shows the mean place along the strip of the sheets on it.
  for (let i = 0; i < N; i++) {
    const qx = XC + x[i] * SX - 0.5, qy = VC - v[i] * SV - 0.5;
    if (S.fresh) (px[i] = qx), (py[i] = qy);
    const mx = 0.5 * (qx + px[i]), my = 0.5 * (qy + py[i]);
    if ((qx - mx) ** 2 + (qy - my) ** 2 < 0.16) splat(D, F, qx, qy, 1, f[i]);
    else splat(D, F, qx, qy, 0.5, f[i]), splat(D, F, mx, my, 0.5, f[i]);
    (px[i] = qx), (py[i] = qy);
  }
  S.fresh = false;
  for (let y = 0, p = 0; y < H; y++)
    for (let x2 = 0; x2 < W; x2++, p++) {
      const d = D[p], o = p * 3;
      let r = 0, g = 0, b = 0;
      if (d > 0.004) {
        const q = min(255, round((F[p] / d) * 255)) * 3, e = min(NB - 1, (d * 32) | 0), br = BR[e], wh = WH[e];
        r = (lut[q] * (1 - wh) + wh) * br;
        g = (lut[q + 1] * (1 - wh) + wh) * br;
        b = (lut[q + 2] * (1 - wh) + wh) * br;
      }
      if (fd > 0) (r = r * (1 - fd) + old[o] * fd), (g = g * (1 - fd) + old[o + 1] * fd), (b = b * (1 - fd) + old[o + 2] * fd);
      (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
      display.setPixel(x2, y, r, g, b);
    }
}
