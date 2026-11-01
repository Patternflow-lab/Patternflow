// ===== Patternflow pattern =====
// Title:   Gauss Circle
// Family:  number
// Idea:    A circle breathes in and out over the integer lattice, drawn turned 45 degrees as single LEDs with a dark LED between each pair, the lattice points inside it lit and the ones outside left as a faint grid, each ring of points flashing white in its group of four or eight as the circle reaches it, while a readout gives the count N(r) and its error against the area pi r^2 and a dotted chart below draws that error over every radius, a jagged band that widens as the circle grows.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gauss's circle problem, the lattice points in a circle counted against its area (Carl Friedrich Gauss); the error is O(r^(2/3)) (Wacław Sierpiński, 1906) and not O(r^(1/2)) (G. H. Hardy, 1915); Lamé curves |x|^p + |y|^p = r^p (Gabriel Lamé); pattern round 84
// Round:   84
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shift=0..0.5, Power=2..6
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the points inside the circle run from cyan at the centre to azure at the rim, the count reads in cyan, and the error and the chart are gold where there are more points than area and blue where there are fewer.
// Knob 2: Speed. At 2 the area inside the circle grows by 72 lattice points a second, so the circle takes 22 s to grow from one point to all 1,565 and 22 s to shrink back, resting 0.8 s at each end; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Shift. Moves the centre of the circle off the lattice point along the diagonal (s, s). At 0 the points join in groups of 4 or 8 and the error is Gauss's; between 0 and 0.5 only the mirror in that diagonal is left, so they come in pairs, or alone on the diagonal; at 0.5 the centre sits in the middle of a cell and the groups of 4 and 8 come back on new circles.
// Knob 4: Power. The exponent p of the Lamé curve |x|^p + |y|^p = r^p the points are counted in. At 2 it is the circle; towards 6 it swells into a rounded square standing on its corner on the panel, its flat sides take in long runs of a lattice row at almost the same radius, and the error chart turns from a ragged band into tall regular teeth.

// The lattice: every LED whose x + y is even is a lattice point, so each
// lit point has four dark neighbours. Lattice point (a, b) sits at pixel
// (31 + a - b, 31 + a + b): the integer lattice Z^2 turned 45 degrees and
// stretched by sqrt 2. Turning and stretching change no count, only the
// unit: a radius of r lattice steps is r sqrt 2 LEDs.
//
// N(r) is the number of (a, b) with a^2 + b^2 <= r^2. Give each lattice
// point the unit square it is the centre of: the squares cover the circle
// of radius r - sqrt(2)/2 and lie inside the one of radius r + sqrt(2)/2,
// which is Gauss's bound |N(r) - pi r^2| <= 2 sqrt(2) pi r for r >= 1.
// The error E(r) = N(r) - pi r^2 is much smaller than that: Sierpiński
// showed it is O(r^(2/3)), and Hardy that it is not O(r^(1/2)). On the
// panel r runs to 22.27, N to 1,565, and E stays between -22.1 and +17.8.
//
// E is a sawtooth. Between radii it falls smoothly, by 2 pi r per unit of
// r, as the area grows with no new point; at r = sqrt(n) it jumps up by
// r2(n), the number of ways n is a sum of two squares, always a multiple
// of 4: mostly 4 or 8, r2(25) = 12, r2(325) = 24. That jump is the group
// that flashes. The chart below gives each column 1/64 of the area swept,
// about 7.8 values of n, and draws every value E takes inside it, so each
// column is a dotted bar from its lowest to its highest error.
//
// Power p counts in the Lamé curve instead, whose area is
// 4 Gamma(1 + 1/p)^2 / Gamma(1 + 2/p) r^2. It has the same eight
// symmetries as the circle, so the groups of 4 and 8 stay, but for p > 2
// the curve is flat where it crosses the two axes, long runs of a lattice
// row join there at almost the same radius, and the error gains a regular
// sawtooth of order r^(1 - 1/p) from those four flat points.

const W = 64, H = 128;
const { floor, round, sqrt, abs, pow, min, max, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The disc: centre pixel and the half width it may reach.
const CX = 31, CY = 31, REACH = 31.5;
// The readout of the count and its error, and the chart under it.
const DIGIT_Y = 66, AXIS = 102, HALF = 24;
// Lattice points a second the area grows by at Speed 2, the pause at
// each end, and how long a flash lasts.
const RATE = 72, REST = 0.8, FLASH = 0.6, SETTLE = 4;
// Levels of the faint lattice outside the circle and in the chart.
const FAINT = 22, FAINT_LOW = 14;

// 3 by 5 figures, drawn as dots two LEDs apart so no two touch.
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
const SIGNS = { "+": "000010111010000", "-": "000000111000000" };

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Lanczos's Gamma, enough for the area of a Lamé curve.
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gamma(z) {
  if (z < 0.5) return PI / (sin(PI * z) * gamma(1 - z));
  z -= 1;
  let x = LG[0];
  for (let i = 1; i < 9; i++) x += LG[i] / (z + i);
  const t = z + 7.5;
  return sqrt(2 * PI) * pow(t, z + 0.5) * exp(-t) * x;
}

// Every lattice point in the top square, as pixel and (a, b).
const SITES = [];
for (let y = 0; y < W; y++)
  for (let x = 0; x < W; x++)
    if (((x + y) & 1) === 0) SITES.push({ x, y, a: (x - CX + y - CY) / 2, b: (y - CY - (x - CX)) / 2 });

// Builds the sorted points, the largest radius that fits and the chart
// for a shift and a power.
function build(S, shift, p) {
  const ap = (4 * gamma(1 + 1 / p) ** 2) / gamma(1 + 2 / p);
  // How far the unit curve reaches in pixels: the most of |a - b|, |a + b|.
  let m = 0;
  for (let i = 0; i < 360; i++) {
    const t = (i / 360) * 2 * PI, c = cos(t), s = sin(t);
    const a = Math.sign(c) * pow(abs(c), 2 / p), b = Math.sign(s) * pow(abs(s), 2 / p);
    m = max(m, abs(a - b), abs(a + b));
  }
  const rhi = (REACH - 2 * shift) / m;
  const rho = (pt) => pow(pow(abs(pt.a - shift), p) + pow(abs(pt.b - shift), p), 1 / p);
  const pts = SITES.map((pt) => ({ x: pt.x, y: pt.y, r: rho(pt), join: -9, leave: -9 }));
  pts.sort((u, v) => u.r - v.r);
  let inside = 0;
  while (inside < pts.length && pts[inside].r <= rhi + 1e-9) inside++;
  const ahi = ap * rhi * rhi;
  // Each column: the lowest and highest E over its slice of the area.
  const lo = new Float32Array(W), hi = new Float32Array(W);
  let k = 0, top = 1;
  const count = (r) => {
    while (k < inside && pts[k].r <= r + 1e-9) k++;
    return k;
  };
  for (let c = 0; c < W; c++) {
    const a0 = (ahi * c) / W, a1 = (ahi * (c + 1)) / W;
    const r0 = sqrt(a0 / ap), r1 = sqrt(a1 / ap);
    let e = count(r0) - a0, l = e, h = e;
    while (k < inside && pts[k].r <= r1) {
      // Just before a jump, then just after it.
      const r = pts[k].r, before = k - ap * r * r;
      count(r);
      const after = k - ap * r * r;
      l = min(l, before);
      h = max(h, after);
    }
    e = count(r1) - a1;
    l = min(l, e);
    h = max(h, e);
    lo[c] = l;
    hi[c] = h;
    top = max(top, -l, h);
  }
  S.pts = pts;
  S.inside = inside;
  S.ap = ap;
  S.rhi = rhi;
  S.ahi = ahi;
  S.lo = lo;
  S.hi = hi;
  // Rows per unit of error: the widest error fills the chart's half height.
  S.scale = HALF / top;
  S.shift = shift;
  S.p = p;
  S.k = -1;
}

export function setup(params) {
  params.s = { t: 0, u: 0.5, dir: 1, rest: 0, hue: 0, pts: null, k: -1, rgb: new Uint8Array(W * H * 3) };
  build(params.s, 0, 2);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 2], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1] == null ? 2 : kv[1], 0.2, 3);
  const shift = cl(kv[2] || 0, 0, 0.5), p = cl(kv[3] == null ? 2 : kv[3], 2, 6);
  if (abs(shift - S.shift) > 1e-4 || abs(p - S.p) > 1e-4) build(S, shift, p);
  S.t += d;
  // The area swept, as a share u of the largest: the time per point is
  // the same at every radius. A short rest at each end.
  if (S.rest > 0) S.rest -= (d * speed) / 2;
  else {
    S.u += (S.dir * d * speed * RATE) / 2 / S.ahi;
    if (S.u >= 1) (S.u = 1), (S.dir = -1), (S.rest = REST);
    else if (S.u <= 0) (S.u = 0), (S.dir = 1), (S.rest = REST);
  }
  // Which points are in: the first k of the sorted list.
  const r = S.rhi * sqrt(S.u);
  let k = 0;
  while (k < S.inside && S.pts[k].r <= r + 1e-9) k++;
  if (S.k >= 0) {
    for (let i = S.k; i < k; i++) S.pts[i].join = S.t;
    for (let i = k; i < S.k; i++) S.pts[i].leave = S.t;
  }
  S.k = k;
  S.r = r;
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function put(rgb, x, y, c, v) {
  const p = (y * W + x) * 3;
  rgb[p] = round(c[0] * v * 255);
  rgb[p + 1] = round(c[1] * v * 255);
  rgb[p + 2] = round(c[2] * v * 255);
}

// A number in dotted figures, its right edge at x when right is set.
function number(rgb, s, x, y, col, right) {
  if (right) x -= s.length * 8 - 4;
  for (let i = 0; i < s.length; i++) {
    const g = SIGNS[s[i]] || DIGITS[s.charCodeAt(i) - 48];
    for (let j = 0; j < 15; j++) if (g[j] === "1") put(rgb, x + i * 8 + (j % 3) * 2, y + floor(j / 3) * 2, col, 1);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.pts) return;
  const rgb = S.rgb, h0 = S.hue + 0.5, now = S.t;
  rgb.fill(0);
  // The faint lattice everywhere below the disc.
  const low = hsv(h0 + 0.1, 0.5, 1);
  for (let y = 64; y < H; y++) for (let x = y & 1; x < W; x += 2) put(rgb, x, y, low, FAINT_LOW / 255);
  // The disc: the points inside lit by their radius, a flash as they join.
  const surplus = hsv(h0 + 0.62, 0.62, 1), deficit = hsv(h0 + 0.1, 0.62, 1), axis = hsv(h0, 0.2, 1);
  const white = [1, 1, 1], pale = hsv(h0, 0.4, 1), gone = hsv(h0 + 0.58, 0.75, 1), faint = hsv(h0 + 0.08, 0.45, 1);
  for (let i = 0; i < S.pts.length; i++) {
    const pt = S.pts[i];
    if (i < S.k) {
      // White as it joins, pale for a few seconds, then the deep colour.
      const age = now - pt.join, deep = hsv(h0 + 0.04 + 0.12 * min(1, pt.r / S.rhi), 0.85, 1);
      if (age < FLASH) put(rgb, pt.x, pt.y, mix(white, pale, age / FLASH), 1);
      else if (age < FLASH + SETTLE) put(rgb, pt.x, pt.y, mix(pale, deep, (age - FLASH) / SETTLE), 1);
      else put(rgb, pt.x, pt.y, deep, 1);
    } else {
      const f = 1 - (now - pt.leave) / FLASH;
      if (f > 0) put(rgb, pt.x, pt.y, gone, max(FAINT / 255, f));
      else put(rgb, pt.x, pt.y, faint, FAINT / 255);
    }
  }
  // The readout: the count on the left, the error on the right.
  const e = round(S.k - S.ap * S.r * S.r);
  number(rgb, String(S.k), 2, DIGIT_Y, hsv(h0, 0.6, 1), false);
  number(rgb, (e > 0 ? "+" : e < 0 ? "-" : "") + abs(e), 62, DIGIT_Y, e < 0 ? deficit : surplus, true);
  // The chart: each column a dotted bar over the errors of its slice,
  // gold above the axis, blue below, white at the present radius and
  // dimmer beyond it.
  const cur = min(W - 1, floor((S.u * W) - 1e-9));
  for (let c = 0; c < W; c++) {
    const y0 = max(AXIS - HALF, round(AXIS - S.hi[c] * S.scale)), y1 = min(AXIS + HALF, round(AXIS - S.lo[c] * S.scale));
    const v = c <= cur ? 1 : 0.42;
    for (let y = y0 + ((y0 + c) & 1); y <= y1; y += 2) put(rgb, c, y, c === cur ? white : y < AXIS ? surplus : y > AXIS ? deficit : axis, v);
    if (((AXIS + c) & 1) === 0 && (AXIS < y0 || AXIS > y1)) put(rgb, c, AXIS, axis, 0.35);
  }
  for (let p = 0, i = 0; p < W * H; p++, i += 3) display.setPixel(p % W, (p / W) | 0, rgb[i], rgb[i + 1], rgb[i + 2]);
}
