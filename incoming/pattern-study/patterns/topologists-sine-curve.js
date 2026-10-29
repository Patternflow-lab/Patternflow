// ===== Patternflow pattern =====
// Title:   Topologist's Sine Curve
// Family:  topology
// Idea:    The graph of sin(1/x) stands on the panel with x running down to the limit segment drawn across near the bottom, its swings packing tighter until they merge into a band that is bright at both edges and dim in the middle by the arcsine law, while a slow zoom toward x = 0 draws new swings out of the band and a bead walks down the curve, swinging faster and faster, and never reaches the segment.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: topologist's sine curve (Lynn Arthur Steen and J. Arthur Seebach Jr., Counterexamples in Topology, 1970), pattern round 73
// Round:   73
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Zoom=0..1, Measure=0..1
//
// Knob 1: Hue. Turns the colours round the wheel: at 0 the curve is aqua where it swings right on its way down and violet where it swings left, the band where the two can no longer be told apart is their periwinkle mix, the segment is pale gold and the bead leaves a gold trail.
// Knob 2: Speed. At 2 a walk takes about 9 s and the zoom breathes in and out once every 30 s; at 0.2 both are ten times slower, at 3 half as fast again.
// Knob 3: Zoom. How near x = 0 the top of the panel is: at 0 the panel shows x from 0.16 down to 0, at 1 from 0.005, where the band takes nearly the whole height. The slow zoom then goes four times nearer and back.
// Knob 4: Measure. What a LED's brightness counts. At 0 it is how much of its row's stretch of x the curve spends in that LED, which in the band is the arcsine law, bright edges and a dim middle. At 1 it is how much curve length passes through the LED, and the band fills flat.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, sqrt, sin, cos, asin, exp, log, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The panel. The curve's x runs down the panel, x = X at the top edge
// and x = 0 on row 121 (Y = 121.5), where the limit segment {0} x [-1, 1]
// lies across. Its value sin(1/x) runs across: -1 at column 4.5, +1 at 59.5.
const YS = 121.5, CX = 32, AMP = 27.5;
const colOf = (s) => CX + AMP * s;

// In the band a row holds so many swings that the share of it the curve
// spends in each column is the arcsine law: (asin s1 - asin s0) / pi for the
// column's stretch s0..s1. Column 4, which only half meets the curve, gets
// 0.061 of the row, 5.25 times the 0.0116 of a middle column, and column 5
// gets 3.9 times. Across, every swing crosses each column twice.
const ARC = new Float32Array(W), OVL = new Float32Array(W);
for (let c = 0; c < W; c++) {
  const s0 = cl((c - CX) / AMP, -1, 1), s1 = cl((c + 1 - CX) / AMP, -1, 1);
  ARC[c] = (asin(s1) - asin(s0)) / PI;
  OVL[c] = (s1 - s0) * AMP;
}

// ---- One row, exactly. Between turning points, u = 1/x walks one way and
// sin u is monotone, with inverse u = k pi + asin((-1)^k s) on the k-th
// piece. Every crossing of a column boundary is then an exact x, so the
// share of the row's x in each column, and the chord length through it, are
// sums of differences: a box filter with no samples to alias. Odd pieces,
// where the curve swings left on its way down, are also kept apart in L.
function rowExact(j, ulo, uhi, span, yScale, M, L, A) {
  const k0 = floor(ulo / PI + 0.5), k1 = floor(uhi / PI + 0.5), o = j * W;
  for (let k = k0; k <= k1; k++) {
    const ua = max(ulo, (k - 0.5) * PI), ub = min(uhi, (k + 0.5) * PI);
    if (ub <= ua) continue;
    const sg = k & 1 ? -1 : 1, cb = colOf(sin(ub)), dir = cb >= colOf(sin(ua)) ? 1 : -1;
    let p = colOf(sin(ua)), xp = 1 / ua;
    for (let guard = 0; guard < 70; guard++) {
      let q = dir > 0 ? floor(p) + 1 : ceil(p) - 1, last = false;
      if (dir > 0 ? q >= cb : q <= cb) (q = cb), (last = true);
      const xq = last ? 1 / ub : 1 / (k * PI + asin(cl((sg * (q - CX)) / AMP, -1, 1)));
      const c = floor((p + q) / 2), dx = abs(xp - xq);
      if (c >= 0 && c < W) {
        M[o + c] += dx / span;
        if (sg < 0) L[o + c] += dx / span;
        A[o + c] += sqrt((q - p) ** 2 + (dx * yScale) ** 2);
      }
      if (last) break;
      (p = q), (xp = xq);
    }
  }
}

export function setup(params) {
  params.s = {
    t: 0, tz: 0, walk: 0, hue: 0, zoom: 0, meas: 0.06, X: 0.16, dt: 0, prevU: 0,
    M: new Float32Array(N), L: new Float32Array(N), A: new Float32Array(N), T: new Float32Array(N), tmp: new Float32Array(N), F: new Float32Array(N * 3),
    C: [0, 1, 2].map(() => new Float32Array(N)), O: [0, 1, 2].map(() => new Float32Array(N)),
  };
}

// ---- Time, in seconds at Speed 2. The bead's share of the way from the
// segment, q = x / X, is (1 - t / 8)^1.25: it comes down the panel at a
// walker's pace, 19 rows a second at first and slower near the end, and
// would touch the segment at 8 s. It cannot: there sin(1/x) has no limit,
// so its swings come without bound, past the frame rate for the last second
// or so, and the walk stops 0.4 LED short, in the band. A new one starts 0.8 s
// later. The zoom divides X by up to 4 and back over 30 s.
const TW = 8, PW = 1.25, Q_END = 0.4 / YS, PAUSE = 0.8, TZ = 30;
const WALK = TW * (1 - Q_END ** (1 / PW));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const e = (d * cl(k[1], 0.2, 3)) / 2;
  S.hue = k[0];
  S.zoom = cl(k[2], 0, 1);
  S.meas = cl(k[3], 0, 1);
  S.tz += e;
  S.walk += e;
  S.dt = e;
  if (S.walk > WALK + PAUSE) (S.walk -= WALK + PAUSE), (S.prevU = 0);
  S.X = 0.16 * 10 ** (-1.5 * S.zoom) * exp(-log(4) * 0.5 * (1 - cos((2 * PI * S.tz) / TZ)));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { M, L, A, T, tmp, F, C, O } = S, [CR, CG, CB] = C, X = S.X, span = X / YS, yScale = YS / X;
  M.fill(0), L.fill(0), A.fill(0);
  // ---- The curve, row by row down to the segment's row.
  for (let j = 0; j <= 121; j++) {
    const xb = X * (1 - j / YS), xa = max(0, X * (1 - (j + 1) / YS));
    const ulo = 1 / xb, uhi = xa > 0 ? 1 / xa : Infinity;
    if (uhi - ulo < 10 * PI) rowExact(j, ulo, uhi, span, yScale, M, L, A);
    else {
      // More than five whole swings: the arcsine law, half of it swinging
      // each way, and the chord length of two crossings a swing.
      const f = (xb - xa) / span, sw = min(40, (uhi - ulo) / (2 * PI)), o = j * W;
      for (let c = 4; c < 60; c++) (M[o + c] += f * ARC[c]), (L[o + c] += 0.5 * f * ARC[c]), (A[o + c] += 2 * sw * OVL[c]);
    }
  }
  // ---- Colour. Brightness from the measure: a share of 1/22 of the row
  // reads 0.63. The curve swings right on its way down in aqua and left in
  // violet, so a visible swing shows both, and in the band, where each row
  // holds as much of one as of the other, they mix to periwinkle. Both hues
  // drift by depth, ln(0.16 / x), so the colour travels with the zoom.
  // The bright edges belong to the measure of x, not to the curve's length:
  // counted by length (Measure 1), every swing crosses each column twice,
  // nearly level, and a band row is the same all across. Checked on row 116
  // of the opening view: 255 at the edges and 97 in the middle at Measure 0,
  // 255 all across at Measure 1.
  const m = S.meas, h0 = S.hue;
  for (let y = 0; y < H; y++) {
    const dh = 0.03 * cl(log(0.16 / (X * max(1e-6, 1 - (y + 0.5) / YS))), -2, 6);
    const ca = hsv(0.47 + h0 + dh, 0.85, 1), cv = hsv(0.71 + h0 + dh, 0.7, 1);
    for (let x = 0, p = y * W; x < W; x++, p++) {
      if (!(M[p] > 0)) {
        CR[p] = CG[p] = CB[p] = 0;
        continue;
      }
      const v = (1 - m) * (1 - exp(-22 * M[p])) + m * (1 - exp(-1.3 * A[p])), l = L[p] / M[p];
      CR[p] = v * (ca[0] + (cv[0] - ca[0]) * l);
      CG[p] = v * (ca[1] + (cv[1] - ca[1]) * l);
      CB[p] = v * (ca[2] + (cv[2] - ca[2]) * l);
    }
  }
  // Glow: a 5-tap blur across and down of each channel, added at 0.7.
  for (let i = 0; i < 3; i++) blur(C[i], tmp, O[i]);

  // ---- The bead. Its path since the last frame is sampled in u, every 0.1
  // rad at most, into a trail that fades in 0.3 s; once it swings faster
  // than the frame, the samples spread across the row, a smear as wide as
  // the band.
  const w = S.walk, fade = exp(-S.dt / 0.3);
  for (let p = 0; p < N; p++) T[p] *= fade;
  let head = null;
  if (w < WALK) {
    const q = (1 - w / TW) ** PW, u = 1 / (q * X), u0 = S.prevU > 0 && S.prevU < u ? S.prevU : u - 1e-3;
    const n = min(400, max(2, ceil((u - u0) / 0.1)));
    for (let i = 1; i <= n; i++) {
      const ui = u0 + ((u - u0) * i) / n;
      dep(T, colOf(sin(ui)), YS * (1 - 1 / (ui * X)), 1.6 / n + 0.02);
    }
    S.prevU = u;
    head = [colOf(sin(u)), YS * (1 - q)];
  }
  // The trail is added on top in gold.
  const seg = hsv(0.13 + h0, 0.35, 1), gold = hsv(0.12 + h0, 0.6, 1), [OR, OG, OB] = O;
  for (let p = 0; p < N; p++) {
    const tr = min(1, T[p]);
    F[p * 3] = min(1, CR[p] + 0.7 * OR[p] + gold[0] * tr);
    F[p * 3 + 1] = min(1, CG[p] + 0.7 * OG[p] + gold[1] * tr);
    F[p * 3 + 2] = min(1, CB[p] + 0.7 * OB[p] + gold[2] * tr);
  }
  // ---- The limit segment on row 121, closed at both ends, and a faint
  // glow on the rows either side.
  for (let x = 4; x < 60; x++) {
    const end = x === 4 || x === 59;
    for (const [dy, a] of [[-1, 0.18], [0, end ? 1 : 0.85], [1, 0.25], [2, 0.08]]) add(F, x, 121 + dy, seg, a);
  }
  // The bead itself: white, with a soft halo 1.5 LEDs across.
  if (head)
    for (let j = -3; j <= 3; j++)
      for (let i = -3; i <= 3; i++) {
        const x = floor(head[0]) + i, y = floor(head[1]) + j, dx = x + 0.5 - head[0], dy = y + 0.5 - head[1];
        add(F, x, y, [1, 0.97, 0.9], 1.3 * exp(-(dx * dx + dy * dy) / 1.1));
      }
  for (let p = 0; p < N; p++) display.setPixel(p % W, floor(p / W), (F[p * 3] * 255) | 0, (F[p * 3 + 1] * 255) | 0, (F[p * 3 + 2] * 255) | 0);
}

// Light added on top of the frame buffer, held to 1.
function add(F, x, y, c, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  (F[o] = min(1, F[o] + c[0] * a)), (F[o + 1] = min(1, F[o + 1] + c[1] * a)), (F[o + 2] = min(1, F[o + 2] + c[2] * a));
}

// A point of the bead's path, split over its four nearest LEDs.
function dep(T, x, y, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const xx = ix + i, yy = iy + j;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) T[yy * W + xx] += a * (i ? ax : 1 - ax) * (j ? ay : 1 - ay);
    }
}

function blur(src, tmp, out) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      tmp[p] = (6 * src[p] + 4 * ((x > 0 ? src[p - 1] : 0) + (x < W - 1 ? src[p + 1] : 0)) + (x > 1 ? src[p - 2] : 0) + (x < W - 2 ? src[p + 2] : 0)) / 16;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      out[p] = (6 * tmp[p] + 4 * ((y > 0 ? tmp[p - W] : 0) + (y < H - 1 ? tmp[p + W] : 0)) + (y > 1 ? tmp[p - 2 * W] : 0) + (y < H - 2 ? tmp[p + 2 * W] : 0)) / 16;
    }
}
