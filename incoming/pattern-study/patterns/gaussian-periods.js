// ===== Patternflow pattern =====
// Title:   Gaussian Periods
// Family:  number
// Idea:    Every residue k mod n lights one LED at its Gaussian period eta(k), a sum of d roots of unity, so eleven rotated deltoids stand as a sunburst of dots coloured by k mod 11; then every point slides to eta(u k), the burst comes apart, and the same set of points builds it again with the copies' colours traded.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gaussian periods (Carl Friedrich Gauss, 1801), plotted as William Duke, Stephan Ramon Garcia and Bob Lutz plotted them (2015), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Figure=0..7, Unit=0..2
//
// Knob 1: Hue. Turns the colour classes round the wheel together. At 0 the class of k = 0 is cyan and the other classes step evenly round the wheel, ordered so that neighbouring spikes get neighbouring hues.
// Knob 2: Speed. At 2 the figure rests 1 second and a rebuild takes 1.75 seconds; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Figure. Eight pairs (n, omega): eleven rotated deltoids (n = 11 * 991), seven (7 * 1201), four (4 * 1201), a deltoid and its negative (2 * 2719), deltoids scaled by 2 cos(2 pi j / 13) (13 * 1021), the five-cusp star of the prime 12011, a nine-point star (9 * 1093) and the deltoid lace of 7^4.
// Knob 4: Unit. Which multiplier u the rebuilds use. At 0 a unit that carries points into other colour classes, at 1 one that keeps every class in place so each copy rebuilds itself, at 2 one that turns whole copies about the centre. A figure without copies uses u = -1 there, which folds it onto its mirror image.
// Buttons: K1 tap goes to the next figure.

const W = 64, H = 128;
const { floor, round, min, max, cos, sin, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// [n, omega, colour kind, m, g, q, x zoom, hue step, three units u].
// Colour kind 0 is k mod m, kind 1 is k mod m up to sign, kind 2 is the class
// of k mod q among the units mod q, read off the m-th powers of the
// primitive root g, with k = 0 mod q a class of its own. Each class is a
// union of whole orbits k, k omega, k omega^2, ..., so every dot has one
// colour. The hue step orders the classes so that neighbouring spikes get
// neighbouring hues. The first unit carries points into other classes (on
// the hexagram none can, so it is a second unit of the next kind), the
// second keeps every class in place, the third turns whole copies about the
// centre (u = 1 mod n / m) or, on a figure without copies, is u = -1.
const FIG = [
  [10901, 9032, 0, 11, 0, 0, 1.2, 3, 882, 870, 992], // 11 * 991, omega = 1 mod 11: eleven rotated deltoids
  [8407, 3032, 0, 7, 0, 0, 1.1, 6, 1363, 2689, 1202], // 7 * 1201: seven rotated deltoids
  [4804, 4173, 0, 4, 0, 0, 1, 3, 679, 1921, 2403], // 4 * 1201: four rotated deltoids
  [5438, 1453, 0, 2, 0, 0, 1, 1, 57, 819, 5437], // 2 * 2719: a deltoid and its negative
  [13273, 3431, 1, 13, 0, 0, 1, 1, 87, 116, 13272], // 13 * 1021, omega = -1 mod 13: deltoids scaled by 2 cos(2 pi j / 13)
  [12011, 2557, 2, 2, 2, 12011, 1, 1, 1819, 151, 12010], // prime, d = 5: the five-cusp star, by quadratic character
  [9837, 151, 0, 3, 0, 0, 1, 1, 2960, 31, 3280], // 9 * 1093, omega of order 3 mod 9 too: a nine-point star
  [2401, 1047, 2, 2, 3, 7, 1, 1, 38, 1086, 2400], // 7^4, d = 3: deltoid lace, by quadratic character of k mod 7
];

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// Build one figure: the orbits of omega on Z/n, eta for every k, the colour
// of each orbit and the scale that fills the panel.
function build(idx) {
  const [n, w, kind, m, g, q, zx, hm, u0, u1, u2] = FIG[idx];
  const pw = [1];
  for (let x = w % n; x !== 1; x = (x * w) % n) pw.push(x);
  const d = pw.length;
  const C = new Float64Array(n), S = new Float64Array(n);
  for (let k = 0; k < n; k++) (C[k] = cos((TAU * k) / n)), (S[k] = sin((TAU * k) / n));
  const er = new Float64Array(n), ei = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let a = 0, b = 0;
    for (let j = 0; j < d; j++) {
      const r = (k * pw[j]) % n;
      a += C[r];
      b += S[r];
    }
    er[k] = a;
    ei[k] = b;
  }
  let lg = null;
  if (kind === 2) {
    lg = new Int32Array(q);
    for (let e = 0, x = 1; e < q - 1; e++, x = (x * g) % q) lg[x] = e % m;
  }
  const seen = new Uint8Array(n), rep = [];
  for (let k = 0; k < n; k++) {
    if (seen[k]) continue;
    for (let j = 0; j < d; j++) seen[(k * pw[j]) % n] = 1;
    rep.push(k);
  }
  const np = rep.length, ncls = kind === 0 ? m : kind === 1 ? (m >> 1) + 1 : m + 1;
  const cls = new Int16Array(np), slot = new Float32Array(ncls);
  for (let p = 0; p < np; p++) {
    const k = rep[p], r = k % m;
    cls[p] = kind === 0 ? r : kind === 1 ? min(r, m - r) : k % q === 0 ? m : lg[k % q];
  }
  for (let c = 0; c < ncls; c++) slot[c] = ((hm * c) % ncls) / ncls;
  let r0 = 1e9, r1 = -1e9, i1 = 0;
  for (let k = 0; k < n; k++) (r0 = min(r0, er[k])), (r1 = max(r1, er[k])), (i1 = max(i1, abs(ei[k])));
  // The imaginary axis runs across and the real axis up, each scaled to the
  // panel, so a round figure stands twice as tall as it is wide and complex
  // conjugation, eta(-k), is the left-right mirror. The eleven and the seven
  // deltoids are drawn 1.2 and 1.1 times wider and lose the tips of their
  // side spikes.
  const sx = (31.2 * zx) / i1, sy = 126.4 / (r1 - r0), cr = (r0 + r1) / 2;
  return {
    idx, n, d, pw, er, ei, sx, sy, cr, ncls, slot, units: [u0, u1, u2],
    cls, cur: Int32Array.from(rep), np, a: new Int32Array(np * d), dl: new Int32Array(np * d),
  };
}

export function setup(params) {
  params.s = { f: build(0), fig: 0, knobFig: 0, t: 0, s: 0, moving: false, u: 0, hue: -1, palHue: -2, pal: [], grid: new Int16Array(W * H) };
}

const TRAVEL = 3.5, REST = 2;

// A rebuild: root j of point k, e(k omega^j / n), turns along the shorter
// arc to e(u k omega^j / n), so the point ends exactly at eta(u k).
function startRebuild(s, u) {
  const { n, d, pw, cur, a, dl, np } = s.f;
  for (let p = 0; p < np; p++) {
    const k = cur[p], v = (u * k) % n;
    for (let j = 0; j < d; j++) {
      const x = (k * pw[j]) % n;
      let e = ((v * pw[j]) % n) - x;
      if (e > n / 2) e -= n;
      else if (e <= -n / 2) e += n;
      a[p * d + j] = x;
      dl[p * d + j] = e;
    }
  }
  s.u = u;
  s.moving = true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06], step = cl(dt || 0, 0, 0.1);
  const kf = cl(round(k[2]), 0, FIG.length - 1);
  if (kf !== s.knobFig) (s.knobFig = kf), (s.fig = kf);
  if (input.btnPressed && input.btnPressed[0]) s.fig = (s.fig + 1) % FIG.length;
  if (s.fig !== s.f.idx) (s.f = build(s.fig)), (s.t = 0), (s.moving = false);
  const f = s.f;
  s.hue = cl(k[0], 0, 1);
  s.t += step * cl(k[1], 0.2, 3);
  if (!s.moving) {
    s.s = 0;
    if (s.t >= REST) (s.t -= REST), startRebuild(s, f.units[cl(round(k[3]), 0, 2)]);
  }
  if (s.moving) {
    if (s.t >= TRAVEL) {
      s.t -= TRAVEL;
      s.moving = false;
      s.s = 0;
      for (let p = 0; p < f.np; p++) f.cur[p] = (s.u * f.cur[p]) % f.n;
    } else {
      const x = s.t / TRAVEL;
      s.s = x * x * (3 - 2 * x);
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const f = s.f, { n, d, er, ei, sx, sy, cr, cls, cur, a, dl, np, ncls, slot } = f;
  if (s.palHue !== s.hue || s.pal.length !== ncls) {
    s.pal = [];
    for (let c = 0; c < ncls; c++) s.pal.push(hsv(s.hue + 0.5 + slot[c], 0.78, 255));
    s.palHue = s.hue;
  }
  const grid = s.grid;
  grid.fill(-1);
  const t = s.s, moving = s.moving && t > 0;
  for (let p = 0; p < np; p++) {
    let re = 0, im = 0;
    if (!moving) (re = er[cur[p]]), (im = ei[cur[p]]);
    else
      for (let j = 0, o = p * d; j < d; j++, o++) {
        const ang = (TAU * (a[o] + t * dl[o])) / n;
        re += cos(ang);
        im += sin(ang);
      }
    const x = floor(31.5 + im * sx + 0.5), y = floor(63.5 - (re - cr) * sy + 0.5);
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = cls[p];
  }
  const pal = s.pal;
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q++) {
      const c = grid[q];
      if (c < 0) display.setPixel(x, y, 0, 0, 0);
      else display.setPixel(x, y, pal[c][0], pal[c][1], pal[c][2]);
    }
}
