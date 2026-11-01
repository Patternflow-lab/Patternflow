// ===== Patternflow pattern =====
// Title:   Parallel Coordinates
// Family:  data
// Idea:    Thirty-two points on one straight line in four to eight dimensions are drawn in parallel coordinates, axes stacked down the tall panel and each point a polyline from axis to axis, so every pair of neighbouring axes has all its segments meet in one bright knot, and as the line turns the knots slide, run off to infinity when a slope passes 1 and come back from the other side, while an inset at the top shows the same points as a turning line in the plane of the first two coordinates.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: parallel coordinates (Maurice d'Ocagne, 1885; Alfred Inselberg, 1985) and their point-line duality, pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Noise=0..1, Axes=4..8
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 each polyline takes its colour from where it starts on the first axis, cyan at the left end through blue to magenta at the right; the axes stay pale grey and the knots' rings white.
// Knob 2: Speed. At 2 the line turns 0.26 radians a second, so each pair of axes sends its knot off to infinity once every 12 s, and the points slide along the line 0.06 of its length a second; 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Noise. Gaussian scatter on every coordinate of every point, standard deviation 0 to 0.2 of the half-width of an axis (0 to 5.8 LEDs). At 0 the knots are single points; at 1 they are loose clouds and the inset's line spreads into a cloud.
// Knob 4: Axes. The dimension of the data and the number of axes, 4 to 8, spread from row 42 to row 124: 27.3 rows between axes at 4, 11.7 at 8. A line in D dimensions shows as D - 1 knots.

// A point (x1, x2) of the plane becomes, in parallel coordinates, the
// segment from x1 on the first axis to x2 on the second. Take every point
// of a line x2 = m x1 + b. With both axes on the same scale, the segment of
// x1 sits at fraction t of the way from axis 1 to axis 2 at
//
//   (1 - t) x1 + t (m x1 + b) = x1 (1 - t + t m) + t b,
//
// which no longer depends on x1 when t = 1 / (1 - m). So all the segments
// pass through one point, at that t and at value b / (1 - m): the line has
// become a point. For m < 0 the point lies between the two axes; for
// 0 < m < 1 it lies past the second axis, for m > 1 before the first, and
// at m = 1 the segments are parallel and the point is at infinity. As m
// passes 1 the knot leaves through one end of the panel and returns
// through the other. Because the point c of the line also has its segment
// through the knot, the knot slides along the extension of c's segment.
//
// In D dimensions the data are points c + s v on a line, v its direction.
// Neighbouring coordinates are then related linearly, x_{k+1} = m_k x_k +
// b_k with m_k = v_{k+1} / v_k, so the line becomes D - 1 knots, one
// between each pair of neighbouring axes (Inselberg's representation of a
// line in R^D by D - 1 points). v turns in a plane: v_k = cos(theta - phi_k)
// with the phases phi_k a little under 2 radians apart, so each m_k sweeps
// every real value once per half turn of theta. When v_k is 0 every point
// has the same x_k and the polylines pinch to one LED on axis k.
//
// Knots outside their own gap are marked by the two outermost segments
// extended to them, dashed and dim, and a ring where they land on the
// panel. The lines add up light: thirty-two segments through one knot saturate
// it to white, and the tone curve 1 - exp(-light) keeps their colour
// elsewhere.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, sin, cos, exp, log, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const N = 32, DMAX = 8;
// Axis rows and value scale: value 1 is 29 LEDs from the middle column.
const TOP = 42, BOT = 124, XC = 31.5, XS = 29;
// The inset: rows 3 to 33, value 1 is 14 LEDs from its centre.
const IX = 31.5, IY = 18, IS = 14, IR = 15;
// Phase steps between neighbouring coordinates of the direction, radians.
const DPHI = [1.92, 2.21, 1.74, 2.47, 1.98, 2.33, 1.81];
// Turn rate at Speed 1, radians a second; slide of the points along the line.
const TURN = 0.13, SLIDE = 0.03;
// Half-length of the line and the reach of its centre's wander.
const A = 0.62, CW = 0.3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function gauss() {
  const u = Math.random() || 1e-9, v = Math.random();
  return sqrt(-2 * log(u)) * cos(2 * PI * v);
}

export function setup(params) {
  const phi = new Float64Array(DMAX);
  for (let k = 1; k < DMAX; k++) phi[k] = phi[k - 1] + DPHI[k - 1];
  const s0 = new Float64Array(N), eps = new Float64Array(N * DMAX);
  for (let i = 0; i < N; i++) s0[i] = (i + 0.2 + 0.6 * Math.random()) / N;
  for (let i = 0; i < N * DMAX; i++) eps[i] = gauss();
  params.s = {
    phi, s0, eps, th: 0.35, tc: 0, sl: 0,
    hue: 0, noise: 0, d: 4,
    v: new Float64Array(DMAX), c: new Float64Array(DMAX),
    x: new Float64Array(N * DMAX), w: new Float64Array(N), col: new Float32Array(N * 3),
    acc: new Float32Array(NP * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 4], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0] || 0, 0, 1);
  const speed = cl(kv[1] == null ? 2 : kv[1], 0.2, 3);
  S.noise = cl(kv[2] || 0, 0, 1);
  S.d = cl(round(kv[3] == null ? 4 : kv[3]), 4, DMAX);
  S.th += d * speed * TURN;
  S.tc += d * speed * 0.05;
  S.sl += d * speed * SLIDE;
  // The scatter wanders: each draw keeps exp(-dt / 4 s) of itself.
  const keep = exp(-d / 4), fresh = sqrt(1 - keep * keep);
  for (let i = 0; i < S.eps.length; i++) S.eps[i] = S.eps[i] * keep + fresh * gauss();
}

// Add colour c times a to the LED (x, y).
function add(acc, x, y, c, o, a) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = (y * W + x) * 3;
  acc[p] += c[o] * a;
  acc[p + 1] += c[o + 1] * a;
  acc[p + 2] += c[o + 2] * a;
}

// An antialiased segment in LED coordinates (an LED's centre is a whole
// number): along its longer extent one step per LED, the light shared
// between the two LEDs either side of the line. Dashed skips every other
// pair of steps.
function seg(acc, xa, ya, xb, yb, c, o, a, dash) {
  const dx = xb - xa, dy = yb - ya;
  if (abs(dy) >= abs(dx)) {
    if (abs(dy) < 1e-6) return;
    const y0 = max(0, Math.ceil(min(ya, yb))), y1 = min(H - 1, floor(max(ya, yb)));
    for (let y = y0; y <= y1; y++) {
      if (dash && (y >> 1) & 1) continue;
      const x = xa + ((y - ya) / dy) * dx, ix = floor(x), f = x - ix;
      add(acc, ix, y, c, o, a * (1 - f));
      add(acc, ix + 1, y, c, o, a * f);
    }
  } else {
    const x0 = max(0, Math.ceil(min(xa, xb))), x1 = min(W - 1, floor(max(xa, xb)));
    for (let x = x0; x <= x1; x++) {
      if (dash && (x >> 1) & 1) continue;
      const y = ya + ((x - xa) / dx) * dy, iy = floor(y), f = y - iy;
      add(acc, x, iy, c, o, a * (1 - f));
      add(acc, x, iy + 1, c, o, a * f);
    }
  }
}

const WHITE = new Float32Array([1, 1, 1]);
const GREY = new Float32Array(3);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const D = S.d, { v, c, x, w, col, acc, phi } = S;
  const gap = (BOT - TOP) / (D - 1);
  const rowOf = (k) => TOP + k * gap;
  const px = (val) => XC + XS * val;
  for (let k = 0; k < D; k++) {
    v[k] = cos(S.th - phi[k]);
    c[k] = CW * sin(S.tc * (1 + 0.17 * k) + 1.7 * k);
  }
  // The points: slid along the line, faded in and out at its ends.
  const sig = 0.2 * S.noise;
  for (let i = 0; i < N; i++) {
    const u = (S.s0[i] + S.sl) % 1, s = 2 * u - 1;
    w[i] = min(1, u / 0.08, (1 - u) / 0.08);
    for (let k = 0; k < D; k++) x[i * DMAX + k] = c[k] + A * s * v[k] + sig * S.eps[i * DMAX + k];
  }
  // Colour by the first coordinate, cyan to violet at Hue 0.
  for (let i = 0; i < N; i++) hsv(S.hue + 0.66 + 0.2 * cl(x[i * DMAX], -1, 1), 0.78, 1, col, i * 3);
  hsv(S.hue + 0.6, 0.12, 1, GREY, 0);
  acc.fill(0);

  // Axes: a faint rule with a tick at 0 and at the ends of the scale.
  for (let k = 0; k < D; k++) {
    const y = round(rowOf(k));
    for (let xx = 2; xx < W - 2; xx++) add(acc, xx, y, GREY, 0, 0.13);
    for (const t of [-1, 0, 1]) {
      const xx = round(px(t));
      add(acc, xx, y - 1, GREY, 0, 0.22);
      add(acc, xx, y + 1, GREY, 0, 0.22);
    }
  }

  // The polylines.
  for (let i = 0; i < N; i++)
    for (let k = 0; k + 1 < D; k++)
      seg(acc, px(x[i * DMAX + k]), rowOf(k), px(x[i * DMAX + k + 1]), rowOf(k + 1), col, i * 3, 0.34 * w[i], false);

  // The knots: the true line's dual point for each pair of axes.
  for (let k = 0; k + 1 < D; k++) {
    const m = abs(v[k]) < 1e-9 ? 1e9 : v[k + 1] / v[k];
    if (abs(1 - m) < 1e-6) continue;
    const t = 1 / (1 - m);
    const ky = rowOf(k) + t * gap, kx = px(c[k] + (c[k + 1] - c[k]) * t);
    if (t < 0 || t > 1) {
      // Off its gap: extend the two outermost segments to it, dashed.
      const from = t < 0 ? k : k + 1;
      const yEnd = cl(ky, TOP - 6, H + 4);
      for (const s of [-1, 1]) {
        const xa = px(c[k] + A * s * v[k]), xb = px(c[k + 1] + A * s * v[k + 1]);
        const xf = from === k ? xa : xb;
        const xe = xa + (xb - xa) * ((yEnd - rowOf(k)) / gap);
        seg(acc, xf, rowOf(from), xe, yEnd, GREY, 0, 0.3, true);
      }
    }
    if (ky > TOP - 5 && ky < H + 2 && kx > -2 && kx < W + 2) {
      const rx = round(kx), ry = round(ky);
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) add(acc, rx + dx, ry + dy, WHITE, 0, 0.55);
    }
  }

  // The inset: the first two coordinates as a scatter in the plane, with
  // the diagonal of slope 1 dashed and a frame round it.
  for (let j = -IR; j <= IR; j++) {
    add(acc, round(IX + j), IY - IR, GREY, 0, 0.12);
    add(acc, round(IX + j), IY + IR, GREY, 0, 0.12);
    add(acc, round(IX - IR), IY + j, GREY, 0, 0.12);
    add(acc, round(IX + IR), IY + j, GREY, 0, 0.12);
    if ((j & 3) < 2 && abs(j) < IR) add(acc, round(IX + j), IY - j, GREY, 0, 0.2);
  }
  {
    // The line itself, dim, across the frame.
    const dx = v[0], dy = v[1], L = sqrt(dx * dx + dy * dy) || 1;
    for (let q = -40; q <= 40; q++) {
      const s = q / 40 * 1.6;
      const ix = round(IX + IS * (c[0] + s * dx / L)), iy = round(IY - IS * (c[1] + s * dy / L));
      if (abs(ix - IX) < IR - 0.5 && abs(iy - IY) < IR - 0.5) add(acc, ix, iy, GREY, 0, 0.09);
    }
  }
  for (let i = 0; i < N; i++) {
    const ix = round(IX + IS * x[i * DMAX]), iy = round(IY - IS * x[i * DMAX + 1]);
    if (abs(ix - IX) < IR - 0.5 && abs(iy - IY) < IR - 0.5) add(acc, ix, iy, col, i * 3, 1.1 * w[i]);
  }

  for (let p = 0; p < NP; p++) {
    const o = p * 3;
    display.setPixel(p % W, floor(p / W), round(255 * (1 - exp(-acc[o]))), round(255 * (1 - exp(-acc[o + 1]))), round(255 * (1 - exp(-acc[o + 2]))));
  }
}
