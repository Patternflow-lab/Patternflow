// ===== Patternflow pattern =====
// Title:   Swallowtail
// Family:  wave
// Idea:    The wave field of the swallowtail diffraction catastrophe on one section of its three control parameters, computed for every LED, with the third parameter swept slowly so the bright fold caustic bends, kinks and unfolds into a swallowtail: two cusps, a point where the caustic crosses itself, and between them a triangle lit by four rays at once and filled with a lattice of fringes, before it folds away again.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: swallowtail catastrophe (René Thom, 1972), diffraction catastrophes (Michael Berry, John Nye and Francis Wright, 1979; Michael Berry and Colin Upstill, 1980), pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wavenumber=-1..1, Rays=0..1
//
// Knob 1: Hue. Turns the three tints round the wheel together. At 0 the light where two rays cross is teal, the triangle where four cross is pink, and the glow that leaks past the caustic into the shadow, where no ray goes, is deep blue; the brightest crests go white. At 0.25 the two-ray light is violet and the triangle gold, at 0.5 red and green, at 0.75 lime and blue.
// Knob 2: Speed. How fast z, the third parameter, is swept from 1.5 down to -6.5 and back. At 2 one sweep takes 24 s: the caustic is one smooth arch for 3.8 s of it, and the swallowtail is open for the other 20.2, at its widest for a moment 4.9 s in. 240 s at 0.2, 16 s at 3.
// Knob 3: Wavenumber. The wavenumber in octaves with the caustic held at the same LEDs, so only the fringes change. At 0 the panel spans x from -15.8 to 30.3 down and y from -11.5 to 11.5 across; at the deepest the cusps sit 29 LEDs either side of the middle on row 26 and the crossing on row 96. At -1 the section covers 0.57 of that down, 0.66 across and 0.76 of the sweep, and the triangle holds a few broad spots; at 1 it covers 1.74, 1.52 and 1.32 and the fringes shrink to two LEDs.
// Knob 4: Rays. Fades the wave field into the picture of rays alone: 2 pi times the density of rays, the mean the fringes swing about, which grows without bound on the caustic. At 0 the field is the full wave; at 1 there are no fringes, the caustic is a sharp bright line and the triangle a flat pink plate, and the bright ridge that runs on past each cusp, where one ray nearly folds, shows plainly.

// The swallowtail is the third of Thom's seven elementary catastrophes, after
// the fold and the cusp: the family of potentials t^5 + z t^3 + y t^2 + x t.
// In optics its integral Sw is the wave a caustic of that shape makes, the
// way the Airy function dresses a fold and Pearcey's integral a cusp. On a
// section of constant z the caustic is the curve
//
//   x = 15 t^4 + 3 z t^2,   y = -10 t^3 - 3 z t.
//
// For z > 0 it is one smooth arch, lit on the outside by two rays and with
// shadow inside. At z = 0 its top sharpens, and for z < 0 it has two cusps,
// at x = -0.15 z^2 and y = +-20 (-z / 10)^(3/2), and crosses itself at
// x = 0.45 z^2 on the axis. The curved triangle between the cusps and the
// crossing is lit by four rays, whose interference fills it with a lattice of
// spots. x runs down the panel, so the triangle hangs from its cusps with
// the crossing under it and the shadow opening below that.
//
// Sw is a sum over nodes t_j of B_j exp(i x t_j) exp(i y t_j^2), one factor
// for the section, one for the row and one for the column, so a row costs
// one multiply-add per LED and node. Sections are built a few rows a frame
// into a third buffer while the panel blends the two finished ones. A
// section takes 4 to 6 frames at the opening wavenumber and up to 11 at the
// highest, and the picture moves smoothly with z.

const W = 64, H = 128, HW = W / 2, N = W * H;
const { floor, min, max, sqrt, sin, cos, exp, ceil, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The section at wavenumber knob 0, in the integral's own units: x runs down
// the panel from XT, y across it, DX of either to an LED.
const DX = 0.36, XT = -15.8;
// The sweep of z, the third parameter, and its period at Speed 2.
const ZHI = 1.5, ZLO = -6.5, PERIOD = 24, PH0 = 0.297;
// The path of integration (below) and the work each frame does.
const KC = 0.32, DD = 0.12, EE = 0.15, LT = 0.6, MARGIN = 0.1, HSTEP = 4.5, BUDGET = 200000;
// Brightness: amplitude over AREF, to the power GAM.
const AREF = 1.9, GAM = 0.8;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// z through one sweep: a cosine, raised to 0.6 so it lingers deep.
const zAt = (ph) => ZHI + (ZLO - ZHI) * ((1 - cos(2 * PI * (ph + PH0))) / 2) ** 0.6;

// Sw(x, y, z) is the integral over real t of exp(i (t^5 + z t^3 + y t^2 + x t)).
// Its stationary points, 5 t^4 + 3 z t^2 + 2 y t + x = 0, are the rays
// through (x, y); where two of them merge is the caustic. For |t| past s0
// no LED of the section has a ray, the phase only climbs, and there the
// path leaves the real axis for the sector round arg t = 18 degrees (and
// 162 on the left) where exp(i t^5) dies. Before s0 it hugs the axis, so no
// LED's integrand grows along the path. The trapezoid rule on this analytic
// path converges geometrically: with h at most 0.03 and the fastest phase
// turn at s0 HSTEP radians a step, 147 to 505 nodes, 36 LEDs spread over
// the panel, checked at five points of the sweep and at wavenumber -1, 0
// and 1, agree with a sum at h = 0.002 to 2e-5.
function s0For(z, X, Y) {
  let s = 5;
  while (s > 0 && 5 * s ** 4 + 3 * z * s * s - 2 * Y * s - X > 0) s -= 0.01;
  return max(0, s) + MARGIN;
}

// A new section: its z and wavenumber, the path, and the tables for it.
function startSection(S, sec) {
  const k = 2 ** S.kn, sx = k ** 0.8, sy = k ** 0.6, sz = k ** 0.4;
  const z = sz * zAt(S.ph), dx = DX * sx, dy = DX * sy, xTop = XT * sx, xBot = xTop + H * dx, Y = HW * dy;
  const s0 = s0For(z, -xTop, Y);
  let om = 0;
  for (let s = 0; s <= s0; s += 0.02) {
    const b = 5 * s ** 4 + 3 * z * s * s;
    om = max(om, b + 2 * Y * s + xBot, -(b - 2 * Y * s + xTop));
  }
  const h = min(0.03, HSTEP / om), J = 2 * ceil((s0 + LT) / h) + 1;
  const B = new Float64Array(2 * J), E = new Float64Array(2 * J), D = new Float64Array(2 * J), F = new Float64Array(2 * HW * J);
  const x0 = xTop + dx / 2;
  for (let j = 0; j < J; j++) {
    const s = (j - (J - 1) / 2) * h, r = sqrt(s * s + DD * DD), v = r - s0, q = sqrt(v * v + EE * EE);
    const ti = (KC * (v + q)) / 2, dti = ((KC * (1 + v / q)) / 2) * (s / r), tr = s;
    const t2r = tr * tr - ti * ti, t2i = 2 * tr * ti, t3r = t2r * tr - t2i * ti, t3i = t2r * ti + t2i * tr;
    const t5r = t3r * t2r - t3i * t2i, t5i = t3r * t2i + t3i * t2r;
    // B = dt exp(i (t^5 + z t^3)), dt = h (1 + i tau'(s)).
    let g = exp(-(t5i + z * t3i)), a = t5r + z * t3r;
    const fr = g * cos(a), fi = g * sin(a);
    B[2 * j] = h * (fr - fi * dti);
    B[2 * j + 1] = h * (fi + fr * dti);
    // E = exp(i x0 t) for the first row, D = exp(i dx t) the step down a row.
    g = exp(-x0 * ti); E[2 * j] = g * cos(x0 * tr); E[2 * j + 1] = g * sin(x0 * tr);
    g = exp(-dx * ti); D[2 * j] = g * cos(dx * tr); D[2 * j + 1] = g * sin(dx * tr);
    // F = exp(i y t^2) for the right half's columns, y = (c + 1/2) dy.
    g = exp(-0.5 * dy * t2i); let pr = g * cos(0.5 * dy * t2r), pi = g * sin(0.5 * dy * t2r);
    g = exp(-dy * t2i);
    const qr = g * cos(dy * t2r), qi = g * sin(dy * t2r);
    for (let c = 0; c < HW; c++) {
      F[2 * (c * J + j)] = pr;
      F[2 * (c * J + j) + 1] = pi;
      const nr = pr * qr - pi * qi;
      pi = pr * qi + pi * qr;
      pr = nr;
    }
  }
  sec.z = z;
  sec.k = k;
  // A wave of wavenumber k through the canonical integral has its intensity
  // times k^(3/5) against the rays' own, which do not depend on k; scaling
  // the amplitude by k^0.3 keeps the light away from the caustic as bright
  // at every knob setting.
  rays(sec, z, dx, dy, xTop, s0, k ** 0.3);
  S.b = { sec, J, B, E, D, F, G: new Float64Array(2 * J), row: 0, amp: k ** 0.3 };
}

// Geometrical optics on the same section: in column y the ray t lands at
// x = -(5 t^4 + 3 z t^2 + 2 y t). Rays are traced at even steps of t and
// each step's piece of x is spread over the rows it crosses, which gives
// each LED its number of rays and their density in x. The density times
// 2 pi is the intensity the rays carry with no interference, the field's
// mean away from the caustic, where it grows without bound.
function rays(sec, z, dx, dy, xTop, s0, amp) {
  const { cnt, ray } = sec;
  cnt.fill(0);
  ray.fill(0);
  const M = 480, dt = (2 * s0) / M;
  for (let c = 0; c < HW; c++) {
    const y = (c + 0.5) * dy;
    const land = (t) => (-(t * (t * (5 * t * t + 3 * z) + 2 * y)) - xTop) / dx;
    let up = land(-s0);
    for (let m = 1; m <= M; m++) {
      const u = land(-s0 + m * dt);
      const a = min(u, up), b = max(u, up), len = b - a;
      up = u;
      if (b <= 0 || a >= H || len < 1e-9) continue;
      for (let r = max(0, floor(a)); r < min(H, ceil(b)); r++) {
        const o = min(b, r + 1) - max(a, r);
        if (o <= 0) continue;
        const p = r * W + HW + c;
        cnt[p] += o;
        ray[p] += (o / len) * dt;
      }
    }
    for (let r = 0; r < H; r++) {
      const p = r * W + HW + c;
      ray[p] = amp * sqrt((2 * PI * ray[p]) / dx);
      cnt[r * W + HW - 1 - c] = cnt[p];
      ray[r * W + HW - 1 - c] = ray[p];
    }
  }
}

// Rows of the section in progress, as many as the budget allows. The left
// half is the mirror of the right: Sw(x, -y, z) is the conjugate of
// Sw(x, y, z), so it has the same amplitude.
function stepSection(S, budget) {
  const b = S.b, { J, B, E, D, F, G, sec } = b;
  let rows = max(1, floor(budget / (HW * J)));
  for (; rows > 0 && b.row < H; rows--, b.row++) {
    const r = b.row;
    for (let j = 0; j < 2 * J; j += 2) {
      const er = E[j], ei = E[j + 1], br = B[j], bi = B[j + 1];
      G[j] = br * er - bi * ei;
      G[j + 1] = br * ei + bi * er;
      const dr = D[j], di = D[j + 1];
      E[j] = er * dr - ei * di;
      E[j + 1] = er * di + ei * dr;
    }
    for (let c = 0; c < HW; c++) {
      let ar = 0, ai = 0;
      for (let j = 0, o = 2 * c * J; j < 2 * J; j += 2, o += 2) {
        const gr = G[j], gi = G[j + 1], fr = F[o], fi = F[o + 1];
        ar += gr * fr - gi * fi;
        ai += gr * fi + gi * fr;
      }
      const A = sqrt(ar * ar + ai * ai) * b.amp;
      sec.amp[r * W + HW + c] = A;
      sec.amp[r * W + HW - 1 - c] = A;
    }
  }
  return b.row >= H;
}

const newSec = () => ({ amp: new Float32Array(N), cnt: new Float32Array(N), ray: new Float32Array(N), z: 0, k: 1 });

export function setup(params) {
  params.s = { hue: 0, speed: 2, kn: 0, mix: 0.06, ph: 0, secs: [newSec(), newSec(), newSec()], prev: 0, cur: 1, b: null };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.kn = cl(k[2] || 0, -1, 1);
  S.mix = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  if (!S.b) {
    // The first two sections whole, a moment apart, so the first frame
    // already has a picture to show.
    const ph = S.ph;
    S.ph = ph - 0.004;
    startSection(S, S.secs[0]);
    stepSection(S, 1e12);
    S.ph = ph;
    startSection(S, S.secs[1]);
    stepSection(S, 1e12);
    startSection(S, S.secs[2]);
  }
  S.ph += (d * S.speed) / 2 / PERIOD;
  // A finished section becomes the one the panel blends toward, and the
  // oldest buffer starts the next.
  if (stepSection(S, BUDGET)) {
    const done = 3 - S.prev - S.cur;
    S.prev = S.cur;
    S.cur = done;
    startSection(S, S.secs[3 - S.prev - S.cur]);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.b) return;
  const P = S.secs[S.prev], C = S.secs[S.cur], w = S.b.row / H, m = S.mix * S.mix * (3 - 2 * S.mix);
  // Tints by the number of rays: 0 (the shadow), 2, and 4 in the triangle,
  // mixed by the fraction of the LED each count covers.
  const h0 = S.hue;
  const c0 = hsv(h0 + 0.66, 0.9, 1), c2 = hsv(h0 + 0.5, 0.85, 1), c4 = hsv(h0 + 0.87, 0.6, 1);
  for (let p = 0; p < N; p++) {
    const A = P.amp[p] + (C.amp[p] - P.amp[p]) * w;
    const R = P.ray[p] + (C.ray[p] - P.ray[p]) * w;
    const n = P.cnt[p] + (C.cnt[p] - P.cnt[p]) * w;
    const a = A + (R - A) * m;
    const v = min(1.25, (a / AREF) ** GAM);
    let r, g, b;
    if (n < 2) {
      const u = n / 2;
      r = c0[0] + (c2[0] - c0[0]) * u; g = c0[1] + (c2[1] - c0[1]) * u; b = c0[2] + (c2[2] - c0[2]) * u;
    } else {
      const u = min(1, (n - 2) / 2);
      r = c2[0] + (c4[0] - c2[0]) * u; g = c2[1] + (c4[1] - c2[1]) * u; b = c2[2] + (c4[2] - c2[2]) * u;
    }
    const wh = max(0, v - 0.8);
    display.setPixel(p % W, (p / W) | 0, min(255, (r * v + wh) * 255) | 0, min(255, (g * v + wh) * 255) | 0, min(255, (b * v + wh) * 255) | 0);
  }
}
