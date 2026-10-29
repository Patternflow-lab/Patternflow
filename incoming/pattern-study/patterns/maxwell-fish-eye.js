// ===== Patternflow pattern =====
// Title:   Maxwell's Fish-Eye
// Family:  line
// Idea:    Inside Maxwell's fish-eye lens, where the index falls off as n0 / (1 + r^2/R^2), 24 rays leave a point source and bend along circles, pulses of light run out along all of them at once, and the ring their heads draw swells, turns over and closes on the image point -R^2 P / |P|^2, every pulse arriving together, while the source drifts and its image swings round the far side of the dotted circle r = R.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Maxwell's fish-eye lens (James Clerk Maxwell, 1854), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Source=-1..1, Profile=0..1
//
// Knob 1: Hue. Turns the fan's colours round the wheel together. At 0 the ray aimed straight at the image is cyan and the one aimed straight away violet, with the pulses paled towards white; at 0.25 the fan runs violet to red, at 0.5 red to yellow-green.
// Knob 2: Speed. At 2 a pulse takes 2.95 s from the source to the image and a new one leaves every 1.18 s, so the arrivals fall between the departures; the source swings 24 degrees either side of the vertical through the centre in 13.7 s and its distance breathes in and out by a fifth over 22.9 s. At 0.2 everything is ten times slower, at 3 a pulse crosses in 1.96 s.
// Knob 3: Source. How far the source sits from the centre, as R e^(K/2) with R = 30 LEDs: at the opening 0 it wanders between 24.6 and 36.6 LEDs out and its image the same, on the far side; at 1 the source rides 40 to 60 LEDs up near the top and the image closes in to 15 to 22 below the centre; at -1 the two swap.
// Knob 4: Profile. Bends the index away from Maxwell's to n0 / (1 + r^2/R^2)^q. Up to 0.1 q = 1 and all 24 rays land within 0.01 LED of the image; then q rises to 1.5 at 1, the rays cross in a cusped caustic instead of a point, and the pulses never come closer together than 3.8 LEDs at 0.25, 9.4 at 0.5 and 8.5 at 1.

// The rays are integrated, not drawn as circles. With n0 = 2 the optical
// length from the source P to the image -R^2 P / |P|^2 is pi R on every ray,
// the length of half a great circle on a sphere of radius R: the fish-eye is
// that sphere seen through stereographic projection, and its rays are the
// great circles. Checked by RK4 in this file and in a separate script: each
// ray is a circle to 1e-8 R, lands on the image to 0.01 LED, and crosses the
// dotted circle r = R at the two ends of one diameter (the sphere's
// equator, which a great circle cuts at opposite points; the angle at which
// a ray crosses it is not fixed, anything from 37 to 90 degrees for a source
// at R/2).
const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, cos, abs, PI, hypot } = Math;
const TAU = 2 * PI;
const OX = 31.5, OY = 63.5, R = 30, R2 = R * R;
const NR = 24, MAXS = 700;
const HALF = PI * R; // optical length from source to image, n0 = 2
const GAP = HALF * 0.4; // optical length between pulses

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

export function setup(params) {
  params.s = {
    t: 0, ph: 0,
    acc: new Float32Array(W * H * 3),
    xs: new Float32Array(NR * MAXS), ys: new Float32Array(NR * MAXS), ls: new Float32Array(NR * MAXS),
    cnt: new Int32Array(NR),
    c: [0, 0, 0],
    k1: [0, 0, 0, 0], k2: [0, 0, 0, 0], k3: [0, 0, 0, 0], k4: [0, 0, 0, 0],
    px: OX, py: 20, qx: OX, qy: 100,
  };
}

// n = 2 / (1 + r^2/R^2)^q, Maxwell's own at q = 1. A ray is stepped in
// its length s along the panel: it turns towards higher n at the rate
// d(theta)/ds = grad(ln n) . (-sin theta, cos theta), with
// grad(ln n) = -2 q x / (R^2 + r^2), and gathers optical length dL = n ds.
// RK4, with steps from 0.8 LEDs near the centre to 1.5% of r far out.
function deriv(x, y, th, q, o) {
  const r2 = x * x + y * y, g = (-2 * q) / (R2 + r2), c = cos(th), s = sin(th);
  o[0] = c; o[1] = s; o[2] = g * (y * c - x * s); o[3] = q === 1 ? 2 / (1 + r2 / R2) : 2 / (1 + r2 / R2) ** q;
}

function trace(S, k, x, y, th, q, Lmax) {
  const base = k * MAXS, a = S.k1, b = S.k2, c3 = S.k3, d = S.k4;
  let L = 0, c = 1;
  S.xs[base] = x; S.ys[base] = y; S.ls[base] = 0;
  while (L < Lmax && c < MAXS) {
    const h = 0.8 + 0.015 * sqrt(x * x + y * y);
    deriv(x, y, th, q, a);
    deriv(x + (h / 2) * a[0], y + (h / 2) * a[1], th + (h / 2) * a[2], q, b);
    deriv(x + (h / 2) * b[0], y + (h / 2) * b[1], th + (h / 2) * b[2], q, c3);
    deriv(x + h * c3[0], y + h * c3[1], th + h * c3[2], q, d);
    x += (h / 6) * (a[0] + 2 * b[0] + 2 * c3[0] + d[0]);
    y += (h / 6) * (a[1] + 2 * b[1] + 2 * c3[1] + d[1]);
    th += (h / 6) * (a[2] + 2 * b[2] + 2 * c3[2] + d[2]);
    L += (h / 6) * (a[3] + 2 * b[3] + 2 * c3[3] + d[3]);
    S.xs[base + c] = x; S.ys[base + c] = y; S.ls[base + c] = L; c++;
  }
  S.cnt[k] = c;
}

function splat(acc, x, y, r, g, b) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let j = 0; j < 2; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    const wy = j ? fy : 1 - fy;
    for (let i = 0; i < 2; i++) {
      const xx = ix + i;
      if (xx < 0 || xx >= W) continue;
      const w = wy * (i ? fx : 1 - fx), o = (yy * W + xx) * 3;
      acc[o] += r * w; acc[o + 1] += g * w; acc[o + 2] += b * w;
    }
  }
}

function seg(acc, x0, y0, x1, y1, r, g, b) {
  if ((x0 < -2 && x1 < -2) || (x0 > W + 1 && x1 > W + 1) || (y0 < -2 && y1 < -2) || (y0 > H + 1 && y1 > H + 1)) return;
  const len = hypot(x1 - x0, y1 - y0), n = Math.ceil(len / 0.6) || 1;
  const w = len / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    splat(acc, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r * w, g * w, b * w);
  }
}

function glow(acc, x, y, rad, r, g, b) {
  const x0 = max(0, floor(x - rad * 2)), x1 = min(W - 1, floor(x + rad * 2) + 1);
  const y0 = max(0, floor(y - rad * 2)), y1 = min(H - 1, floor(y + rad * 2) + 1);
  for (let yy = y0; yy <= y1; yy++)
    for (let xx = x0; xx <= x1; xx++) {
      const d2 = ((xx - x) ** 2 + (yy - y) ** 2) / (rad * rad);
      const w = exp(-d2);
      const o = (yy * W + xx) * 3;
      acc[o] += r * w; acc[o + 1] += g * w; acc[o + 2] += b * w;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  S.hue = k[0]; S.speed = k[1]; S.src = k[2]; S.q = 1 + 0.5 * max(0, (k[3] - 0.1) / 0.9) ** 1.5;
  S.t += dt * S.speed;
  S.ph += dt * S.speed * 16;
  const sw = 0.42 * sin(S.t * 0.23);
  const d = R * exp(0.5 * S.src + 0.2 * sin(S.t * 0.137 + 1));
  S.px = d * sin(sw); S.py = -d * cos(sw);
  const m = R2 / (d * d);
  S.qx = -m * S.px; S.qy = -m * S.py;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const acc = S.acc;
  acc.fill(0);
  const c = S.c;
  // the circle r = R, dotted
  for (let i = 0; i < 96; i++) {
    const a = (TAU * i) / 96;
    splat(acc, OX + R * cos(a), OY + R * sin(a), 0.16, 0.14, 0.2);
  }
  const Lmax = HALF * 1.6;
  const axis = Math.atan2(S.qy - S.py, S.qx - S.px);
  const Lp = S.ph % GAP;
  for (let k = 0; k < NR; k++) {
    const off = (TAU * (k + 0.5)) / NR;
    trace(S, k, S.px, S.py, axis + off, S.q, Lmax);
    const wide = abs(((off + PI) % TAU) - PI) / PI; // 0 for the ray aimed at the image, 1 for the one aimed away
    hsv(S.hue + 0.5 + 0.28 * wide, 0.85, 1, c);
    const base = k * MAXS, cnt = S.cnt[k];
    for (let i = 1; i < cnt; i++) {
      const L = S.ls[base + i];
      const dim = L < HALF ? 0.22 : 0.13 * max(0, 1 - (L - HALF) / (0.6 * HALF));
      seg(acc, OX + S.xs[base + i - 1], OY + S.ys[base + i - 1], OX + S.xs[base + i], OY + S.ys[base + i], c[0] * dim, c[1] * dim, c[2] * dim);
    }
    // pulses, GAP apart in optical length, so the arrivals fall between the departures
    for (let pz = 0; pz < 4; pz++) {
      const Lh = Lp + pz * GAP;
      const fade = Lh < HALF ? 1 : max(0, 1 - (Lh - HALF) / (0.5 * HALF));
      for (let i = 1; i < cnt; i++) {
        const L0 = S.ls[base + i - 1], L1 = S.ls[base + i];
        if (L1 < Lh - 8 || L0 > Lh) continue;
        const a = min(1, max(0, 1 - (Lh - L1) / 8));
        const v = 1.2 * a * a * fade;
        seg(acc, OX + S.xs[base + i - 1], OY + S.ys[base + i - 1], OX + S.xs[base + i], OY + S.ys[base + i], (c[0] * 0.6 + 0.4) * v, (c[1] * 0.6 + 0.4) * v, (c[2] * 0.6 + 0.4) * v);
      }
    }
  }
  glow(acc, OX + S.px, OY + S.py, 1.3, 1.4, 1.0, 0.6);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, 255 * (1 - exp(-acc[o] * 1.6)), 255 * (1 - exp(-acc[o + 1] * 1.6)), 255 * (1 - exp(-acc[o + 2] * 1.6)));
    }
}
