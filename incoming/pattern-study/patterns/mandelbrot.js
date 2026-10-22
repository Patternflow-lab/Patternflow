// ===== Patternflow pattern =====
// Title:   Mandel Dive
// Family:  fractal
// Idea:    The whole Mandelbrot set stands on the panel and the view falls toward one point of its edge, colour bands flowing out of the black, until the dive fades back into the whole set and falls again.
// Author:  patternflow-lab
// Date:    2026-10-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern study 2026-10
// Round:   2
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.25..4, Spot=0..3, Bands=1..3.5
//
// Knob 1: Hue. Turns the colour bands around the wheel.
// Knob 2: Speed. How fast the view falls, from one doubling every eight seconds to two a second.
// Knob 3: Spot. Where the dive goes: a mini-brot that is the whole set again, seahorse valley, elephant valley or a spiral.
// Knob 4: Bands. How tightly the colour bands are packed, from slow washes to fine contour rings.
// Buttons: K1 tap starts the next dive now.

const W = 64;
const H = 128;
const N = W * H;
// Width across the panel at the start of a dive: the whole set, antenna up.
const W0 = 2.9;
const C0R = -0.68;
const C0I = 0;
// Doublings the old and the new dive overlap while one fades into the other.
const FADE = 1.6;

// The period-9 mini-brot on the antenna is the whole set shrunk by
// MINI_SIZE about the point below, so a dive toward that point ends on the
// picture it started from.
const MINI_NUCLEUS = -1.78586564641067;
const MINI_SIZE = 3.465e-4;
// Target re and im, doublings deep, spin in radians per doubling, how fast
// the target drifts to the middle of the panel (0 keeps it where it starts),
// and a turn made over the first doublings. Seahorse valley is a crack
// between two black discs; turned upright it runs down the tall panel
// instead of across it.
const SPOTS = [
  [MINI_NUCLEUS / (1 - MINI_SIZE), 0, Math.log2(1 / MINI_SIZE), 0, 0, 0],
  [-0.743643887037151, 0.13182590420533, 14.6, 0.1, 0.14, Math.PI / 2],
  [0.3157737473855642, 0.0372087816115407, 17.5, -0.09, 0.12, 0],
  [-0.761574, -0.0847596, 11.8, 0.14, 0.14, -Math.PI / 2],
];

// The LEDs iterated afresh on each of four frames, as x and y parity. The
// other three in four are carried over from where the last frame had them.
const PHASE_X = [0, 1, 1, 0];
const PHASE_Y = [0, 1, 0, 1];

function dive() {
  return {
    spot: 0,
    zeta: 0,
    boost: 1.3,
    dark: 0.3,
    mu: new Float32Array(N),
    last: new Float32Array(N),
    // Frames since each LED's value was iterated.
    age: new Uint8Array(N),
    lastAge: new Uint8Array(N),
    // The view of the last frame: target, scaled cos and sin, target's place on the panel.
    view: new Float64Array(6),
    fresh: true,
  };
}

export function setup(params) {
  params.a = dive();
  params.b = dive();
  params.fading = false;
  params.started = false;
  params.frame = 0;
  params.rgb = new Float32Array(N * 3);
  params.lut = new Float32Array(512 * 3);
  params.lutHue = -1;
  params.phase = 0;
}

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// Two bands of the palette: dark troughs between crests of neighbouring hues.
function buildLut(params, hue) {
  const lut = params.lut;
  for (let i = 0; i < 512; i++) {
    const a = (i / 256) * Math.PI;
    const band = 0.5 + 0.5 * Math.cos(a * 2);
    const h = hue + 0.17 * Math.sin(a) + 0.05 * band;
    hsv(h, 0.92 - 0.45 * band * band * band, 0.2 + 0.72 * Math.pow(band, 1.3), lut, i * 3);
  }
  params.lutHue = hue;
}

// Doublings to fall this frame. The way into a valley passes doublings that
// are mostly the black body of the set, so the fall hurries while the panel is dark.
function fall(d, dt, rate) {
  d.boost += (1 + 12 * d.dark * d.dark * d.dark - d.boost) * Math.min(1, dt * 3);
  return dt * rate * d.boost;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 1];
  // K1 at 0 opens on cyan rather than the red most of the study opens on.
  const hue = k[0] + 0.53;
  if (hue !== params.lutHue) buildLut(params, hue);
  params.bands = k[3];
  const spot = Math.max(0, Math.min(3, Math.round(k[2])));
  if (!params.started) {
    params.a.spot = spot;
    params.started = true;
  }
  const rate = k[1] * 0.5;
  const a = params.a;
  const b = params.b;
  // While one dive fades into the next they fall together, so the mini-brot
  // and the whole set it gives way to stay the same size.
  const step = params.fading ? fall(b, dt, rate) : fall(a, dt, rate);
  a.zeta += step;
  if (params.fading) b.zeta += step;
  params.phase += dt * (0.3 + rate * 0.3);

  const kick = input.btnPressed && input.btnPressed[0];
  if (!params.fading && (a.zeta >= SPOTS[a.spot][2] || kick || spot !== a.spot)) {
    params.fading = true;
    b.spot = spot;
    b.zeta = 0;
    b.boost = 1.3;
    b.dark = 0.3;
    b.fresh = true;
  }
  if (params.fading && b.zeta >= FADE) {
    params.a = b;
    params.b = a;
    params.fading = false;
  }
}

// log2 of the smooth escape count at one point, or -1 inside the set.
function escape(cr, ci, maxit) {
  // The main cardioid and the period-2 disc are inside without iterating.
  const xr = cr - 0.25;
  const q = xr * xr + ci * ci;
  if (q * (q + xr) <= 0.25 * ci * ci || (cr + 1) * (cr + 1) + ci * ci <= 0.0625) return -1;
  let zr = 0;
  let zi = 0;
  let zr2 = 0;
  let zi2 = 0;
  let n = 0;
  let sr = 0;
  let si = 0;
  let span = 8;
  let count = 0;
  while (n < maxit) {
    zi = 2 * zr * zi + ci;
    zr = zr2 - zi2 + cr;
    zr2 = zr * zr;
    zi2 = zi * zi;
    n++;
    if (zr2 + zi2 > 1024) return Math.log2(n + 2 - Math.log2(0.5 * Math.log2(zr2 + zi2)));
    // An orbit that comes back to where it was is caught in a cycle: inside.
    const dr = zr - sr;
    const di = zi - si;
    if (dr * dr + di * di < 1e-20) return -1;
    if (++count === span) {
      count = 0;
      span += span;
      sr = zr;
      si = zi;
    }
  }
  return -1;
}

// One view of the set into the dive's `mu`. A quarter of the LEDs are
// iterated each frame; the rest look up where they were on the last frame,
// which the fall has only moved by a fraction of an LED.
function render(d, frame) {
  const s = SPOTS[d.spot];
  const tr = s[0];
  const ti = s[1];
  const zeta = d.zeta;
  const px = (W0 / W) * Math.pow(2, -zeta);
  const turn = Math.min(1, zeta / 4);
  const ang = s[3] * zeta + s[5] * turn * turn * (3 - 2 * turn);
  const ca = Math.cos(ang) * px;
  const sa = Math.sin(ang) * px;
  // Where the target sits on the panel, in LEDs from the middle; real runs down the panel.
  const drift = Math.pow(2, -s[4] * zeta);
  const ty = ((tr - C0R) / (W0 / W)) * drift;
  const tx = ((ti - C0I) / (W0 / W)) * drift;
  const maxit = Math.min(560, 110 + Math.floor(zeta * 24));

  const swap = d.last;
  d.last = d.mu;
  d.mu = swap;
  const swapAge = d.lastAge;
  d.lastAge = d.age;
  d.age = swapAge;
  const mu = d.mu;
  const last = d.last;
  const age = d.age;
  const lastAge = d.lastAge;
  const v = d.view;
  const lca = v[2];
  const lsa = v[3];
  const lk = 1 / (lca * lca + lsa * lsa);
  const fresh = d.fresh;
  const fx = PHASE_X[frame & 3];
  const fy = PHASE_Y[frame & 3];
  let dark = 0;
  let counted = 0;
  for (let y = 0; y < H; y++) {
    const oy = y + 0.5 - H / 2 - ty;
    for (let x = 0; x < W; x++) {
      const ox = x + 0.5 - W / 2 - tx;
      const cr = tr + oy * ca - ox * sa;
      const ci = ti + oy * sa + ox * ca;
      const p = y * W + x;
      if (!fresh && ((x & 1) !== fx || (y & 1) !== fy)) {
        const dr = cr - v[0];
        const di = ci - v[1];
        const ly = Math.round((dr * lca + di * lsa) * lk + v[5] + H / 2 - 0.5);
        const lx = Math.round((di * lca - dr * lsa) * lk + v[4] + W / 2 - 0.5);
        // A value is carried at most three frames, or it would smear
        // outward along the fall.
        const q = ly * W + lx;
        if (lx >= 0 && lx < W && ly >= 0 && ly < H && lastAge[q] < 3) {
          mu[p] = last[q];
          age[p] = lastAge[q] + 1;
          continue;
        }
      }
      const m = escape(cr, ci, maxit);
      mu[p] = m;
      age[p] = 0;
      counted++;
      if (m < 0) dark++;
    }
  }
  v[0] = tr;
  v[1] = ti;
  v[2] = ca;
  v[3] = sa;
  v[4] = tx;
  v[5] = ty;
  d.fresh = false;
  d.dark = dark / counted;
}

// Colour bands from the escape count, dimmed wherever the count changes
// faster than a band or so per LED: on 64 by 128 LEDs the lace at the edge
// of the set would otherwise be confetti.
function shade(params, mu, weight, first) {
  const rgb = params.rgb;
  const lut = params.lut;
  const dens = params.bands;
  const phase = params.phase;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const l = mu[p];
      let f = 0;
      let i = 0;
      if (l >= 0) {
        const a = mu[x > 0 ? p - 1 : p];
        const b = mu[x < W - 1 ? p + 1 : p];
        const c = mu[y > 0 ? p - W : p];
        const d = mu[y < H - 1 ? p + W : p];
        if (a >= 0 && b >= 0 && c >= 0 && d >= 0) {
          const g = Math.max(Math.abs(b - a), Math.abs(d - c)) * dens;
          const r = g / 0.5;
          f = weight / (1 + r * r);
          // Adding the phase moves the bands outward, the way the fall does.
          let s = (l * dens + phase) * 0.5;
          s -= Math.floor(s);
          i = Math.floor(s * 512) * 3;
        }
      }
      const o = p * 3;
      if (first) {
        rgb[o] = lut[i] * f;
        rgb[o + 1] = lut[i + 1] * f;
        rgb[o + 2] = lut[i + 2] * f;
      } else {
        rgb[o] += lut[i] * f;
        rgb[o + 1] += lut[i + 1] * f;
        rgb[o + 2] += lut[i + 2] * f;
      }
    }
  }
}

export function draw(display, params, time) {
  const rgb = params.rgb;
  const frame = params.frame++;
  render(params.a, frame);
  if (!params.fading) {
    shade(params, params.a.mu, 1, true);
  } else {
    const m0 = Math.min(1, params.b.zeta / FADE);
    const m = m0 * m0 * (3 - 2 * m0);
    shade(params, params.a.mu, 1 - m, true);
    render(params.b, frame);
    shade(params, params.b.mu, m, false);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, rgb[p], rgb[p + 1], rgb[p + 2]);
    }
  }
}
