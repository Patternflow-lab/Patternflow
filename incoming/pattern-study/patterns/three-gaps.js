// ===== Patternflow pattern =====
// Title:   Three Gaps
// Family:  number
// Idea:    Each row is the circle unrolled across the panel with one more of the points 0, a, 2a, 3a, ... (mod 1) on it than the row above, every stretch coloured by which of the at most three gap lengths it lies in, while a drifts between a golden-ratio number and the fractions beside it and the gaps split, merge and collapse into repeating columns.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: three-gap theorem (conjectured by Hugo Steinhaus, proved by Vera T. Sós, 1957), pattern round 30
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Alpha=0..1, Points=0..1
//
// Knob 1: Hue. Turns the three colours round the wheel together. At 0 the longest gaps are yellow, the middle ones cyan and the shortest magenta; two lengths within 15% of each other share the colour between theirs, green at 0 for the long pair.
// Knob 2: Speed. How fast a travels. At 2 it goes from 0.618 to 13/21 in 2.2 s, back, out to 8/13 in 3.5 s and back again, 11.4 s round; at 0.2 the round takes 114 s.
// Knob 3: Alpha. Where a sets out from: 1/phi = 0.618 at 0, sliding down to the bronze ratio (sqrt 13 - 3)/2 = 0.303 at 1. From there a visits the nearest fraction with denominator up to 21 on each side, 13/21 and 8/13 at 0, 3/10 and 4/13 at 1. At 0.25 a starts at 0.539, just off 7/13, and the rows past 13 lean into a V of thirteen columns.
// Knob 4: Points. How many points the bottom row holds: 30 at 0, 36 at the start, 130 at 1. The rows share them out evenly, 3 or 4 rows to each count at the start. Past about 64 points a gap is narrower than an LED and each LED blends four samples.
// Buttons: K1 tap sends a straight to the stop at the end of the leg it is on.

const W = 64, H = 128, SS = 4, NMAX = 160, Q = 21;
const { min, max, floor, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => u * u * (3 - 2 * u);
const GOLD = (Math.sqrt(5) - 1) / 2, BRONZE = (Math.sqrt(13) - 3) / 2;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c];
}

// The two fractions with denominator at most 21 that hold a0 between them,
// found by walking down the Stern-Brocot tree: 8/13 and 13/21 for 1/phi.
function bracket(a0) {
  let a = 0, b = 1, c = 1, d = 1;
  for (;;) {
    const p = a + c, q = b + d;
    if (q > Q) break;
    if (a0 < p / q) (c = p), (d = q);
    else (a = p), (b = q);
  }
  return [a / b, c / d];
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, k3: -1, a0: GOLD, ends: [GOLD, GOLD], u: 0, nmax: 36, alpha: GOLD,
    pos: new Float64Array(NMAX + 1), idx: new Int32Array(NMAX + 1), sep: new Float32Array(W),
    row: new Float32Array(W * 3), lut: new Float32Array(3 * 64), lutHue: NaN,
  };
}

const stop = (P, i) => (i & 1 ? P.ends[i >> 1] : P.a0);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.nmax = floor(30 + 100 * cl(k[3], 0, 1));
  const k3 = cl(k[2], 0, 1);
  if (k3 !== P.k3) {
    P.k3 = k3;
    P.a0 = GOLD + (BRONZE - GOLD) * k3;
    // The nearer fraction first. On a fraction exactly, points would land on
    // each other and floating point would shuffle their order; 3e-7 off it,
    // on a0's side, they stay in order and the picture is the same.
    const [lo, hi] = bracket(P.a0);
    P.ends = P.a0 - lo < hi - P.a0 ? [lo + 3e-7, hi - 3e-7] : [hi - 3e-7, lo + 3e-7];
  }
  if (input.btnPressed && input.btnPressed[0]) P.u = floor(P.u) + 1;
  // a goes a0, first fraction, a0, second fraction, a0, easing in and out of
  // each stop; a longer leg takes longer, so the bottom row never runs away.
  const s = floor(P.u) & 3, from = stop(P, s), to = stop(P, (s + 1) & 3);
  P.u += (d * P.speed * 0.15) / (0.4 + abs(to - from) / 0.004);
  const s2 = floor(P.u) & 3, A = stop(P, s2), B = stop(P, (s2 + 1) & 3);
  P.alpha = A + (B - A) * ease(P.u - floor(P.u));
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { pos, idx, sep, row, lut } = P, a = P.alpha, nmax = P.nmax;
  if (P.lutHue !== P.hue) {
    // Colour by the rank of the length: yellow the longest, cyan the middle,
    // magenta the shortest, and mixes for ranks in between. Mixed as light,
    // not round the wheel, which would put a dark blue between cyan and
    // magenta, then brought back to saturation 0.7 so a mix is not grey.
    const c3 = new Float32Array(9);
    for (let c = 0; c < 3; c++) hsv(P.hue + 0.15 + c * 0.36, 0.88, 1, c3, c * 3);
    for (let i = 0; i < 64; i++) {
      const r = (i / 63) * 2, j = min(1, floor(r)), f = r - j, o = i * 3;
      for (let ch = 0; ch < 3; ch++) lut[o + ch] = c3[j * 3 + ch] * (1 - f) + c3[j * 3 + 3 + ch] * f;
      const mx = max(lut[o], lut[o + 1], lut[o + 2]), sat = 1 - min(lut[o], lut[o + 1], lut[o + 2]) / mx;
      if (sat < 0.7) for (let ch = 0; ch < 3; ch++) lut[o + ch] = mx - ((mx - lut[o + ch]) * 0.7) / max(sat, 1e-3);
    }
    P.lutHue = P.hue;
  }
  const dv = [0, 0, 0, 0], dl = [0, 0, 0, 0], rank = [0, 0, 0, 0];
  let n = 0;
  for (let y = 0; y < H; y++) {
    // Row y holds n points, n growing down the panel. New points go into the
    // sorted list one at a time, so a frame sorts nothing twice.
    const want = 1 + floor((y * nmax) / H);
    let tick = -1;
    while (n < want) {
      const p = n * a - floor(n * a);
      let lo = 0, hi = n;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (pos[m] < p) lo = m + 1;
        else hi = m;
      }
      for (let j = n; j > lo; j--) (pos[j] = pos[j - 1]), (idx[j] = idx[j - 1]);
      pos[lo] = p;
      idx[lo] = n;
      tick = floor(p * W);
      n++;
    }
    pos[n] = 1;
    idx[n] = 0;
    // The gap from point i to point j is frac((j - i) a) long, so the index
    // difference names the length, and the theorem says there are at most
    // three. The newest point always lands in a longest gap and cuts it into
    // one gap of each of the two shorter lengths already on the circle, which
    // is why the longest is the sum of the other two. When the last longest
    // gap is cut, the middle length is the longest and the cutting goes on.
    let nc = 0;
    for (let i = 0; i < n; i++) {
      const dd = idx[i + 1] - idx[i];
      let c = 0;
      while (c < nc && dv[c] !== dd) c++;
      if (c === nc && nc < 4) (dv[nc] = dd), (dl[nc] = pos[i + 1] - pos[i]), nc++;
    }
    // Rank: how many lengths are longer, counting a length within 15% as
    // half. Near a fraction p/q the shortest shrinks towards nothing and the
    // other two meet, so their gaps go one colour as the three become two.
    for (let c = 0; c < nc; c++) {
      let r = 0;
      for (let e = 0; e < nc; e++) if (e !== c) r += cl(0.5 + (dl[e] - dl[c]) / (0.3 * max(dl[e], dl[c])), 0, 1);
      rank[c] = min(2, r);
    }
    // Points closer than a third of an LED count as one. A lone one between
    // two gaps wider than an LED draws a dark line, darker the wider they are.
    sep.fill(0);
    let first = 0;
    while (first < n - 1 && (pos[first + 1] - pos[first]) * W < 0.34) first++;
    for (let i = 0, prev = -1; i < n; i++) {
      const gr = (pos[i + 1] - pos[i]) * W;
      if (gr < 0.34 && i < n - 1) continue;
      const gl = prev < 0 ? (pos[first] + 1 - pos[n - 1]) * W : (pos[i] - pos[prev]) * W;
      const x = floor(pos[i] * W);
      sep[x] = max(sep[x], cl((min(gl, gr) - 1.1) / 2.4, 0, 1));
      prev = i;
    }
    // Four samples to an LED. Brightness follows the gap's length times n,
    // which runs about 0.4 to 1.9 at 1/phi: a gap brightens down the panel
    // until a point cuts it.
    row.fill(0);
    let g = 0;
    for (let x = 0; x < W; x++)
      for (let s = 0; s < SS; s++) {
        const u = (x + (s + 0.5) / SS) / W;
        while (pos[g + 1] <= u) g++;
        const dd = idx[g + 1] - idx[g];
        let c = 0;
        while (c < nc - 1 && dv[c] !== dd) c++;
        const v = 0.6 + 0.4 * cl((n * (pos[g + 1] - pos[g]) - 0.4) / 1.3, 0, 1), q = floor(rank[c] * 31.5) * 3;
        row[x * 3] += lut[q] * v;
        row[x * 3 + 1] += lut[q + 1] * v;
        row[x * 3 + 2] += lut[q + 2] * v;
      }
    // The newest point, white on the row where it arrives: they fall on a
    // lattice, and each heads the dark line its point draws below.
    for (let x = 0; x < W; x++) {
      const f = (255 / SS) * (1 - 0.85 * sep[x]);
      if (x === tick) display.setPixel(x, y, 255, 255, 255);
      else display.setPixel(x, y, row[x * 3] * f, row[x * 3 + 1] * f, row[x * 3 + 2] * f);
    }
  }
}
