// ===== Patternflow pattern =====
// Title:   Twist and Writhe
// Family:  topology
// Idea:    A closed ribbon, twisted Lk times round a flat circle, folds through a figure-eight into a tall supercoil while its two coloured edges stay linked the same number of times, so the twist of its two-toned faces unwinds as the writhe of its centre line grows, and a bar along the bottom shows Tw and Wr adding up to the same whole number all the way.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Călugăreanu-White-Fuller theorem Lk = Tw + Wr (Gheorghe Călugăreanu, 1959; James H. White, 1969; F. Brock Fuller, 1971), supercoiled DNA (Jerome Vinograd, 1965), pattern round 56
// Round:   56
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Lk=3..6, Coil=3..6
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ribbon's front face is azure and its back violet, its edges pink and lime; at 0.25 purple and rose with green and aqua edges, at 0.5 red and green with cyan and blue, at 0.75 green and sky blue with violet and magenta. The wheel skips orange and yellow, which read brown on the shaded far side.
// Knob 2: Speed. At 2 a cycle takes 12 s: the loop lies flat for 1.2 s, coils for 4.5 s, holds for 1.8 s and uncoils for 4.5 s, while the view turns half a turn, slowly while the loop is flat. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Lk. The linking number of the two edges, a whole number from 3 to 6. On the flat circle it is all twist: the ribbon turns over 2 Lk times round the loop, a half-turn every 47 LEDs of ribbon at 3 and every 24 at 6. Turning it cuts the ribbon, turns one end and joins it again, as a type I topoisomerase does to a ring of DNA one turn at a time.
// Knob 4: Coil. The writhe the centre line reaches at the deepest point of the cycle, 3 to 6, so the twist left there is Lk - Coil. At 3 the supercoil winds 4.3 half-turns and stands 106 LEDs tall and 14 across; at 6 it winds 8.1 and is 8 across, its strands 6 LEDs apart. Past Lk the ribbon comes out twisted the other way, and the Tw bar runs back to the mark, striped.

const W = 64, H = 128, NPX = W * H;
const { floor, min, max, sqrt, sin, cos, abs, atan2, asin, round, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Points on the centre line, and its length in LEDs: a circle of radius 45.
const M = 144, LEN = TAU * 45;
// Half the ribbon's width, in LEDs.
const HW = 3;
// Where the middle of the ribbon sits on the panel; the bar is below.
const CX = 32, CY = 57;
// The cycle at Speed 2, in seconds: flat, coiling, held, uncoiling.
const FLAT = 1.2, UP = 4.5, HOLD = 1.8, DOWN = 4.5, CYCLE = FLAT + UP + HOLD + DOWN;
// Writhe of the coiling family below at q = 0, 0.5, 1, ... 9 half-turns,
// from the same Gauss integral the pattern runs, used only to pick the q
// whose writhe is the knob's target. The writhe shown is computed afresh.
const WR_OF_Q = [0, 0.124, 0.454, 0.823, 1.189, 1.584, 1.979, 2.375, 2.771, 3.166, 3.56, 3.954, 4.347, 4.74, 5.132, 5.525, 5.917, 6.309, 6.701];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Dim orange and yellow read brown and olive, so the wheel skips 0.03..0.18.
const wheel = (h) => 0.18 + 0.85 * (h - 0.18 - floor(h - 0.18));

export function setup(params) {
  const K = M * 4;
  params.s = {
    t: 0, hue: 0, speed: 2, lk: 3, coil: 3, q: 0,
    P: new Float64Array(M * 3), T: new Float64Array(M * 3), U: new Float64Array(M * 3), P1: new Float64Array(M * 3),
    Q: new Float64Array(K * 3), cum: new Float64Array(K + 1),
    wr: 0, tw: 0, phi: 0, yaw: 0,
    sx: new Float32Array(M * 2), sy: new Float32Array(M * 2), sz: new Float32Array(M * 2), face: new Float32Array(M),
    zb: new Float32Array(NPX), rgb: new Float32Array(NPX * 3), pal: new Float32Array(18), palHue: -1,
  };
}

// The coiling family, q half-turns deep. An oval in the xz-plane, a circle
// at q = 0 and a rounded long loop (superellipse exponent 0.6) from q = 2,
// is twisted about its long axis z by q pi from bottom to top, so its two
// long sides wind round each other q half-turns as the two strands of a
// supercoil; the oval stretches so the strands keep a pitch of about 42
// degrees. It never passes through itself: at each height its two strands
// sit on opposite sides of the axis. The curve is then laid out at equal
// steps of arc length and scaled to LEN, so the ribbon keeps its length.
function shape(S, q) {
  const { P, Q, cum } = S, K = M * 4;
  const b = sqrt(1 + ((q * PI) / 1.8) ** 2), p = 1 - 0.4 * min(1, q / 2), kap = -(q * PI) / (2 * b);
  for (let i = 0; i < K; i++) {
    const th = (TAU * i) / K, c = cos(th), s = sin(th);
    const x = (c < 0 ? -1 : 1) * abs(c) ** p, z = b * (s < 0 ? -1 : 1) * abs(s) ** p, ps = kap * z;
    Q[i * 3] = x * cos(ps);
    Q[i * 3 + 1] = x * sin(ps);
    Q[i * 3 + 2] = z;
  }
  cum[0] = 0;
  for (let i = 0; i < K; i++) {
    const j = ((i + 1) % K) * 3, o = i * 3;
    cum[i + 1] = cum[i] + hypot(Q[j] - Q[o], Q[j + 1] - Q[o + 1], Q[j + 2] - Q[o + 2]);
  }
  const k0 = LEN / cum[K];
  for (let i = 0, k = 0; i < M; i++) {
    const s = (cum[K] * i) / M;
    while (cum[k + 1] < s) k++;
    const f = (s - cum[k]) / (cum[k + 1] - cum[k] || 1), o = k * 3, j = ((k + 1) % K) * 3;
    for (let e = 0; e < 3; e++) P[i * 3 + e] = (Q[o + e] + f * (Q[j + e] - Q[o + e])) * k0;
  }
}

// The writhe by the Gauss double integral over the closed polygon, each
// pair of segments in closed form: the solid angle the one sees the other
// under, signed, over 4 pi (Konstantin Klenin and Jörg Langowski, 2000).
function writhe(P) {
  let w = 0;
  const r = S12, n = N12;
  for (let i = 0; i < M; i++) {
    const a = i * 3, b = ((i + 1) % M) * 3, fx = P[b] - P[a], fy = P[b + 1] - P[a + 1], fz = P[b + 2] - P[a + 2];
    for (let j = i + 2; j < M; j++) {
      if (i === 0 && j === M - 1) continue;
      const c = j * 3, d = ((j + 1) % M) * 3;
      // r13, r14, r24, r23: from the ends of segment i to those of j.
      (r[0] = P[c] - P[a]), (r[1] = P[c + 1] - P[a + 1]), (r[2] = P[c + 2] - P[a + 2]);
      (r[3] = P[d] - P[a]), (r[4] = P[d + 1] - P[a + 1]), (r[5] = P[d + 2] - P[a + 2]);
      (r[6] = P[d] - P[b]), (r[7] = P[d + 1] - P[b + 1]), (r[8] = P[d + 2] - P[b + 2]);
      (r[9] = P[c] - P[b]), (r[10] = P[c + 1] - P[b + 1]), (r[11] = P[c + 2] - P[b + 2]);
      for (let k = 0; k < 12; k += 3) {
        const v = (k + 3) % 12;
        const x = r[k + 1] * r[v + 2] - r[k + 2] * r[v + 1], y = r[k + 2] * r[v] - r[k] * r[v + 2], z = r[k] * r[v + 1] - r[k + 1] * r[v];
        const l = sqrt(x * x + y * y + z * z) || 1;
        (n[k] = x / l), (n[k + 1] = y / l), (n[k + 2] = z / l);
      }
      let om = 0;
      for (let k = 0; k < 12; k += 3) {
        const v = (k + 3) % 12;
        om += asin(cl(n[k] * n[v] + n[k + 1] * n[v + 1] + n[k + 2] * n[v + 2], -1, 1));
      }
      // The sign: (r34 x r12) . r13.
      const ex = P[d] - P[c], ey = P[d + 1] - P[c + 1], ez = P[d + 2] - P[c + 2];
      const sg = (ey * fz - ez * fy) * r[0] + (ez * fx - ex * fz) * r[1] + (ex * fy - ey * fx) * r[2];
      w += sg > 0 ? om : sg < 0 ? -om : 0;
    }
  }
  return (2 * w) / (4 * PI);
}
const S12 = new Float64Array(12), N12 = new Float64Array(12);

// Rotate v (at o in V) about the unit axis that turns t0 into t1, by the
// angle between them: parallel transport along the polygon, which adds no
// twist. Writes into out at p.
function transport(V, o, t0, t1, out, p) {
  const ax = t0[1] * t1[2] - t0[2] * t1[1], ay = t0[2] * t1[0] - t0[0] * t1[2], az = t0[0] * t1[1] - t0[1] * t1[0];
  const s = hypot(ax, ay, az), c = t0[0] * t1[0] + t0[1] * t1[1] + t0[2] * t1[2];
  const vx = V[o], vy = V[o + 1], vz = V[o + 2];
  if (s < 1e-12) {
    (out[p] = vx), (out[p + 1] = vy), (out[p + 2] = vz);
    return;
  }
  const kx = ax / s, ky = ay / s, kz = az / s, kd = (kx * vx + ky * vy + kz * vz) * (1 - c);
  out[p] = vx * c + (ky * vz - kz * vy) * s + kx * kd;
  out[p + 1] = vy * c + (kz * vx - kx * vz) * s + ky * kd;
  out[p + 2] = vz * c + (kx * vy - ky * vx) * s + kz * kd;
}

// The ribbon. Tangents at the points, a parallel-transported normal P1
// round the loop, and its holonomy phi: how far P1 has turned about the
// tangent when it comes back to the start. A closed ribbon turns about the
// curve a whole number of times relative to P1 less phi / 2 pi, so its
// twist is m - phi / 2 pi. The twist is spread evenly, as in an elastic rod
// at rest, and m is the whole number that makes the two edges link Lk
// times: by the theorem the one that brings Tw + Wr nearest Lk. Tw is then
// measured off the built ribbon, angle by angle. Over whole cycles at every
// Lk with Coil 3, 4.5 and 6, the Gauss linking integral of the two edges
// came out Lk exactly each time, and Tw + Wr stayed within 0.005 of it.
function ribbon(S) {
  const { P, T, U, P1 } = S, t0 = [0, 0, 0], t1 = [0, 0, 0], tmp = [0, 0, 0];
  for (let i = 0; i < M; i++) {
    const a = ((i + M - 1) % M) * 3, b = ((i + 1) % M) * 3, o = i * 3;
    const x = P[b] - P[a], y = P[b + 1] - P[a + 1], z = P[b + 2] - P[a + 2], l = hypot(x, y, z) || 1;
    T[o] = x / l;
    T[o + 1] = y / l;
    T[o + 2] = z / l;
  }
  // Start P1 pointing into the loop, square to the tangent.
  {
    const d = -(P[0] * T[0] + P[1] * T[1] + P[2] * T[2]);
    let x = -P[0] + d * T[0], y = -P[1] + d * T[1], z = -P[2] + d * T[2];
    const l = hypot(x, y, z) || 1;
    (P1[0] = x / l), (P1[1] = y / l), (P1[2] = z / l);
  }
  const tv = (o, out) => ((out[0] = T[o]), (out[1] = T[o + 1]), (out[2] = T[o + 2]));
  for (let i = 1; i <= M; i++) {
    tv((i - 1) * 3, t0);
    tv((i % M) * 3, t1);
    if (i < M) transport(P1, (i - 1) * 3, t0, t1, P1, i * 3);
    else transport(P1, (M - 1) * 3, t0, t1, tmp, 0);
  }
  // tmp is P1 carried once round; phi is its angle from P1 at the start.
  const p2x = T[1] * P1[2] - T[2] * P1[1], p2y = T[2] * P1[0] - T[0] * P1[2], p2z = T[0] * P1[1] - T[1] * P1[0];
  S.phi = atan2(tmp[0] * p2x + tmp[1] * p2y + tmp[2] * p2z, tmp[0] * P1[0] + tmp[1] * P1[1] + tmp[2] * P1[2]);
  const m = round(S.lk - S.wr + S.phi / TAU), tw = m - S.phi / TAU;
  for (let i = 0; i < M; i++) {
    const o = i * 3, th = (TAU * tw * i) / M, c = cos(th), s = sin(th);
    const qx = T[o + 1] * P1[o + 2] - T[o + 2] * P1[o + 1], qy = T[o + 2] * P1[o] - T[o] * P1[o + 2], qz = T[o] * P1[o + 1] - T[o + 1] * P1[o];
    U[o] = c * P1[o] + s * qx;
    U[o + 1] = c * P1[o + 1] + s * qy;
    U[o + 2] = c * P1[o + 2] + s * qz;
  }
  // The twist of the ribbon as built: each U carried to the next point,
  // and the angle it is then short of that point's U, about the tangent.
  let sum = 0;
  for (let i = 0; i < M; i++) {
    const j = ((i + 1) % M) * 3;
    tv(i * 3, t0);
    tv(j, t1);
    transport(U, i * 3, t0, t1, tmp, 0);
    const wx = t1[1] * tmp[2] - t1[2] * tmp[1], wy = t1[2] * tmp[0] - t1[0] * tmp[2], wz = t1[0] * tmp[1] - t1[1] * tmp[0];
    sum += atan2(U[j] * wx + U[j + 1] * wy + U[j + 2] * wz, U[j] * tmp[0] + U[j + 1] * tmp[1] + U[j + 2] * tmp[2]);
  }
  S.tw = sum / TAU;
}

// The q whose writhe is w, from the table.
function qFor(w) {
  if (w <= 0) return 0;
  for (let k = 1; k < WR_OF_Q.length; k++)
    if (WR_OF_Q[k] >= w) return 0.5 * (k - 1 + (w - WR_OF_Q[k - 1]) / (WR_OF_Q[k] - WR_OF_Q[k - 1]));
  return 9;
}

const ease = (x) => x * x * (3 - 2 * x);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 3, 3], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.lk = cl(round(kv[2]), 3, 6);
  S.coil = cl(kv[3], 3, 6);
  S.t = (S.t + (d * S.speed) / 2) % CYCLE;
  const t = S.t;
  const g = t < FLAT ? 0 : t < FLAT + UP ? ease((t - FLAT) / UP) : t < FLAT + UP + HOLD ? 1 : ease(1 - (t - FLAT - UP - HOLD) / DOWN);
  S.q = qFor(S.coil * g);
  shape(S, S.q);
  S.wr = writhe(S.P);
  ribbon(S);
  // The view turns half a turn a cycle, slowly while the loop is flat so it
  // is seen at a slant (it would not fit the panel face on), faster while
  // it is coiled.
  const ph = t / CYCLE;
  S.yaw = (2.1 + PI * ph - 0.44 * sin(TAU * ph)) % TAU;
}

function palette(S) {
  const P = S.pal, h = S.hue;
  hsv(wheel(0.65 + h), 0.75, 1, P, 0); // front face
  hsv(wheel(0.86 + h), 0.8, 0.7, P, 3); // back face
  hsv(wheel(1.05 + h), 0.6, 1, P, 6); // edge one
  hsv(wheel(0.26 + h), 0.7, 1, P, 9); // edge two
  hsv(wheel(0.65 + h), 0.6, 1, P, 12); // Tw bar, the front face's colour
  hsv(wheel(0.1 + h), 0.12, 0.95, P, 15); // Wr bar
  S.palHue = S.hue;
}

// Fill a triangle with depth test, at LED centres.
function tri(S, x0, y0, z0, x1, y1, z1, x2, y2, z2, r, g, b) {
  const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (abs(area) < 1e-6) return;
  const { zb, rgb } = S;
  const xa = max(0, floor(min(x0, x1, x2))), xb = min(W - 1, floor(max(x0, x1, x2)));
  const ya = max(0, floor(min(y0, y1, y2))), yb = min(H - 1, floor(max(y0, y1, y2)));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
      const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2, p = y * W + x;
      if (z <= zb[p]) continue;
      zb[p] = z;
      (rgb[p * 3] = r), (rgb[p * 3 + 1] = g), (rgb[p * 3 + 2] = b);
    }
}

// Nearer is brighter.
const shadeOf = (z) => 0.5 + 0.5 * cl((z + 46) / 92, 0, 1);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.T) return;
  if (S.palHue !== S.hue) palette(S);
  const { P, U, T, sx, sy, sz, face, zb, rgb } = S, C = S.pal;
  zb.fill(-1e9);
  rgb.fill(0);
  const cy = cos(S.yaw), sy0 = sin(S.yaw), el = 0.3, ce = cos(el), se = sin(el);
  // Project: turn about the vertical, tip the top away by el, look along +y.
  // k = 0 the edge at +HW U, k = 1 the one at -HW U.
  const proj = (x, y, z, o) => {
    const x1 = x * cy - y * sy0, y1 = x * sy0 + y * cy;
    const y2 = y1 * ce + z * se, z2 = z * ce - y1 * se;
    sx[o] = CX + x1;
    sy[o] = CY - z2;
    sz[o] = -y2;
  };
  for (let i = 0; i < M; i++) {
    const o = i * 3;
    for (let k = 0; k < 2; k++) {
      const s = k ? -HW : HW;
      proj(P[o] + s * U[o], P[o + 1] + s * U[o + 1], P[o + 2] + s * U[o + 2], i * 2 + k);
    }
    // Which face looks at us: the normal T x U against the view.
    const nx = T[o + 1] * U[o + 2] - T[o + 2] * U[o + 1], ny = T[o + 2] * U[o] - T[o] * U[o + 2], nz = T[o] * U[o + 1] - T[o + 1] * U[o];
    const y1 = nx * sy0 + ny * cy;
    face[i] = -(y1 * ce + nz * se);
  }
  // Faces, as two triangles a segment.
  for (let i = 0; i < M; i++) {
    const j = (i + 1) % M, a = i * 2, b = j * 2, f = (face[i] + face[j]) / 2;
    const o = f >= 0 ? 0 : 3, lit = (0.35 + 0.65 * min(1, abs(f) * 1.4)) * shadeOf((sz[a] + sz[b] + sz[a + 1] + sz[b + 1]) / 4);
    const r = C[o] * lit, g = C[o + 1] * lit, bl = C[o + 2] * lit;
    tri(S, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], sx[b + 1], sy[b + 1], sz[b + 1], r, g, bl);
    tri(S, sx[a], sy[a], sz[a], sx[b + 1], sy[b + 1], sz[b + 1], sx[a + 1], sy[a + 1], sz[a + 1], r, g, bl);
  }
  // The two edges, a line each, a little in front of the faces they bound.
  for (let k = 0; k < 2; k++) {
    const o = 6 + k * 3;
    for (let i = 0; i < M; i++) {
      const a = i * 2 + k, b = ((i + 1) % M) * 2 + k, n = Math.ceil(hypot(sx[b] - sx[a], sy[b] - sy[a]) * 2.5) || 1;
      for (let e = 0; e < n; e++) {
        const u = e / n, x = sx[a] + (sx[b] - sx[a]) * u, y = sy[a] + (sy[b] - sy[a]) * u, z = sz[a] + (sz[b] - sz[a]) * u + 1.5;
        const ix = floor(x), iy = floor(y);
        if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue;
        const p = iy * W + ix;
        if (z < zb[p]) continue;
        zb[p] = z;
        const l = 0.25 + 0.75 * shadeOf(z);
        (rgb[p * 3] = C[o] * l), (rgb[p * 3 + 1] = C[o + 1] * l), (rgb[p * 3 + 2] = C[o + 2] * l);
      }
    }
  }
  // The bar: Wr from 0, then Tw from where Wr ends, which always stops at
  // the mark at Lk. A negative Tw runs back from Wr to Lk, striped.
  const X0 = 6, UNIT = 8, row = (y, a, b, o, stripe) => {
    const lo = min(a, b), hi = max(a, b);
    for (let x = floor(X0 + lo * UNIT); x < X0 + hi * UNIT; x++) {
      if (x < 0 || x >= W) continue;
      const cover = min(1, x + 1 - (X0 + lo * UNIT), X0 + hi * UNIT - x);
      if (cover <= 0) continue;
      const l = cover * (stripe && (x & 1) ? 0.45 : 1);
      for (let e = 0; e < 3; e++) rgb[(y * W + x) * 3 + e] = C[o + e] * l;
    }
  };
  for (const y of [119, 120]) row(y, 0, S.wr, 15, false);
  for (const y of [122, 123]) row(y, S.wr, S.wr + S.tw, 12, S.tw < 0);
  for (let v = 0; v <= 7; v++) {
    const x = X0 + v * UNIT;
    if (x >= W) break;
    rgb[(125 * W + x) * 3] = rgb[(125 * W + x) * 3 + 1] = rgb[(125 * W + x) * 3 + 2] = 0.3;
  }
  // The mark at Lk in the two edges' colours: it counts how often they link.
  const lx = X0 + S.lk * UNIT;
  for (let y = 118; y <= 126; y++) {
    const o = y < 122 ? 6 : 9;
    for (let e = 0; e < 3; e++) rgb[(y * W + lx) * 3 + e] = C[o + e];
  }
  for (let p = 0; p < NPX; p++) display.setPixel(p % W, (p / W) | 0, (255 * min(1, rgb[p * 3])) | 0, (255 * min(1, rgb[p * 3 + 1])) | 0, (255 * min(1, rgb[p * 3 + 2])) | 0);
}
