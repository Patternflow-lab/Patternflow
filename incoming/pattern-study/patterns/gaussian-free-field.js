// ===== Patternflow pattern =====
// Title:   Gaussian Free Field
// Family:  noise
// Idea:    The discrete Gaussian free field on the panel's 64 by 128 lattice, an amber land above zero and a dark violet sea below, its zero level lines drawn as white coastlines that close into nested loops, while every sine mode of the field wanders on its own and the whole map redraws itself within a second or two; with the boundary knob up, one white line climbs all 128 rows, the SLE(4) curve.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: discrete Gaussian free field, whose contour lines converge to SLE(4) (Oded Schramm and Scott Sheffield, 2009), pattern round 52
// Round:   52
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Boundary=0..1, Grain=0..1
//
// Knob 1: Hue. The colour of the land. At 0 it rises from orange through amber to gold, a step at every height of 0.63 (the height gap, see Boundary); at 0.25 green, at 0.5 sky blue, at 0.75 pink, and back to orange at 1. The sea stays violet, leaning bluer or redder, and the coastlines stay white.
// Knob 2: Speed. Each of the 8,192 sine modes wanders as its own Ornstein-Uhlenbeck process, smoothed in time, so at every instant the field has the free field's law. At 2 the largest mode forgets itself in 0.7 s and the finest, two LEDs from crest to crest, in 0.14 s; at 0.2 ten times slower, at 3 one and a half times faster.
// Knob 3: Boundary. What lies outside the frame. At 0 the field is zero all round, and the coastlines are closed loops, nested, which tend to CLE(4). Turned up, the frame is held at +h on its left half and -h on its right, up to h = sqrt(pi/8) = 0.63 at 1: then exactly one coastline runs from the middle of the bottom edge to the middle of the top, the chordal SLE(4), and from 0.33 on it is drawn two LEDs wide while the other coastlines dim to pale amber.
// Knob 4: Grain. The width of the Gaussian blur under the coastlines and bands, from 1.4 LEDs at 0 to 5 at 1, where the land breaks into a few smooth blobs; it opens at 1.6. The shading always shows the lattice field itself, lit from the upper left.

const W = 64, H = 128, N = W * H, HW = W / 2, HH = H / 2;
const { floor, min, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The height gap: with -LAM on one boundary arc and +LAM on the other the
// zero line between them is SLE(4), for a field whose covariance is the
// inverse of the lattice Laplacian.
const LAM = sqrt(PI / 8);

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

// Sine modes, orthonormal: SX[j * W + x] is mode j at column x and, the
// matrix being symmetric, also mode x at column j. LA is the eigenvalue of
// minus the lattice Laplacian for mode (j, k), stored at j * H + k.
const SX = new Float64Array(W * W), SY = new Float64Array(H * H), LA = new Float64Array(N);
for (let j = 0; j < W; j++) for (let x = 0; x < W; x++) SX[j * W + x] = sqrt(2 / (W + 1)) * sin((PI * (j + 1) * (x + 1)) / (W + 1));
for (let k = 0; k < H; k++) for (let y = 0; y < H; y++) SY[k * H + y] = sqrt(2 / (H + 1)) * sin((PI * (k + 1) * (y + 1)) / (H + 1));
for (let j = 0; j < W; j++) for (let k = 0; k < H; k++) LA[j * H + k] = 4 - 2 * cos((PI * (j + 1)) / (W + 1)) - 2 * cos((PI * (k + 1)) / (H + 1));
const LMIN = LA[0];
// The field is drawn with a blur of a third of an LED, which leaves the lattice
// as it is: AMP is each mode's standard deviation, 1 / sqrt(l), times the
// square root of 1.5 that the filter in update takes away. TAU is each
// mode's relaxation time as a share of the largest mode's.
const C0 = 0.05, AMP = new Float64Array(N), TAU = new Float64Array(N);
for (let i = 0; i < N; i++) {
  AMP[i] = (sqrt(1.5) * exp(-C0 * LA[i])) / sqrt(LA[i]);
  TAU[i] = (LMIN / LA[i]) ** 0.2;
}

// Normal deviates from a table of 4096 quantiles of the unit normal, read
// off its distribution function summed in steps of a thousandth and scaled
// to unit variance: one draw of Math.random each.
const GT = new Float64Array(4096);
{
  let c = 0, i = 0, v = 0;
  for (let z = -6; z < 6 && i < 4096; z += 0.001) {
    const c2 = c + (exp(-((z + 0.0005) ** 2) / 2) * 0.001) / sqrt(2 * PI);
    while (i < 4096 && (i + 0.5) / 4096 <= c2) GT[i++] = z + (0.001 * ((i + 0.5) / 4096 - c)) / (c2 - c);
    c = c2;
  }
  for (i = 0; i < 4096; i++) v += GT[i] * GT[i];
  v = sqrt(v / 4096);
  for (i = 0; i < 4096; i++) GT[i] /= v;
}
const gauss = () => GT[(Math.random() * 4096) | 0];

// Modes B (j, k at B[j * H + k]) to the field F[y * W + x], one axis at a
// time. Mode k is even or odd about the middle row as k + 1 is odd or even,
// so each sum serves a row and its mirror; the same for columns.
function synth(B, T, F) {
  for (let j = 0; j < W; j++) {
    const b = j * H;
    for (let y = 0; y < HH; y++) {
      const r = y * H;
      let e = 0, o = 0;
      for (let k = 0; k < H; k += 2) {
        e += B[b + k] * SY[r + k];
        o += B[b + k + 1] * SY[r + k + 1];
      }
      T[y * W + j] = e + o;
      T[(H - 1 - y) * W + j] = e - o;
    }
  }
  for (let y = 0; y < H; y++) {
    const t = y * W;
    for (let x = 0; x < HW; x++) {
      const r = x * W;
      let e = 0, o = 0;
      for (let j = 0; j < W; j += 2) {
        e += SX[r + j] * T[t + j];
        o += SX[r + j + 1] * T[t + j + 1];
      }
      F[t + x] = e + o;
      F[t + W - 1 - x] = e - o;
    }
  }
}

export function setup(params) {
  const S = (params.s = {
    hue: 0, speed: 2, bnd: 0, grain: 0.06, qd: -1,
    z: new Float64Array(N), a: new Float64Array(N), Q: new Float64Array(N), R: new Float64Array(N), Z: new Float64Array(N),
    B: new Float64Array(N), T: new Float64Array(N), F: new Float64Array(N), U: new Float64Array(N), G: new Float64Array(N), V: new Float64Array(N),
    K: new Float64Array(24), P: new Float64Array(H + 40), side: new Int8Array(N), stack: new Int32Array(N), chord: new Uint8Array(N), c: [0, 0, 0],
  });
  for (let i = 0; i < N; i++) S.z[i] = S.a[i] = gauss();
  // The harmonic part for the Dobrushin boundary: +1 outside the left half
  // of the frame and -1 outside the right half. Minus its Laplacian inside
  // is what the edge LEDs see beyond the frame, so it is that source divided
  // by each mode's eigenvalue. The sine matrices are symmetric, so synth run
  // on the source laid out by column gives its modes laid out by row.
  const f = S.B, m = S.F;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let s = 0;
      if (x === 0) s += 1;
      if (x === W - 1) s -= 1;
      if (y === 0 || y === H - 1) s += x < HW ? 1 : -1;
      f[x * H + y] = s;
    }
  synth(f, S.T, m);
  for (let j = 0; j < W; j++) for (let k = 0; k < H; k++) f[j * H + k] = m[k * W + j] / LA[j * H + k];
  synth(f, S.T, S.U);
}

// The pixels joined to the left arc through LEDs above zero (side 1), and
// those joined to the right arc through the rest (side 2): the zero line
// between the two is the chordal one, from the middle of the bottom edge to
// the middle of the top.
function sides(S) {
  const V = S.V, sd = S.side, st = S.stack;
  sd.fill(0);
  let n = 0;
  const seed = (p, s) => {
    if (!sd[p] && (s === 2 || V[p] > 0)) (sd[p] = s), (st[n++] = p);
  };
  const fill = (s) => {
    while (n) {
      const p = st[--n], x = p % W;
      if (x > 0) seed(p - 1, s);
      if (x < W - 1) seed(p + 1, s);
      if (p >= W) seed(p - W, s);
      if (p < N - W) seed(p + W, s);
    }
  };
  for (let y = 0; y < H; y++) seed(y * W, 1);
  for (let x = 0; x < HW; x++) seed(x, 1), seed(N - W + x, 1);
  fill(1);
  for (let y = 0; y < H; y++) seed(y * W + W - 1, 2);
  for (let x = HW; x < W; x++) seed(x, 2), seed(N - W + x, 2);
  fill(2);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.bnd = cl(k[2], 0, 1);
  S.grain = cl(k[3], 0, 1);
  // Each mode is an Ornstein-Uhlenbeck process seen through an exponential
  // filter of half its time constant, which smooths its path in time; the
  // filter takes its variance to 1 / 1.5, which AMP gives back, so at every
  // instant the modes are independent normals and the field is the free
  // field. The largest mode forgets itself in about 0.7 s at Speed 2.
  const z = S.z, a = S.a, B = S.B, Q = S.Q, R = S.R, Z = S.Z;
  const qd = (d * S.speed) / (0.7 * 2);
  if (qd !== S.qd) {
    S.qd = qd;
    for (let i = 0; i < N; i++) {
      const q = exp(-qd / TAU[i]);
      Q[i] = q;
      Z[i] = sqrt(1 - q * q);
      R[i] = q * q;
    }
  }
  for (let i = 0; i < N; i++) {
    z[i] = z[i] * Q[i] + Z[i] * gauss();
    a[i] = a[i] * R[i] + z[i] * (1 - R[i]);
    B[i] = a[i] * AMP[i];
  }
  synth(B, S.T, S.F);
  // The field the level lines are drawn on: the same field blurred by a
  // Gaussian of Grain's width, zero outside the panel as the boundary is.
  const sg = 1.4 + 3.6 * S.grain, rad = min(20, Math.ceil(2.5 * sg)), K = S.K;
  let ks = 0;
  for (let i = 0; i <= rad; i++) ks += (K[i] = exp((-i * i) / (2 * sg * sg))) * (i ? 2 : 1);
  for (let i = 0; i <= rad; i++) K[i] /= ks;
  const F = S.F, G = S.G, V = S.V, U = S.U, P = S.P, g = S.bnd * LAM;
  // Rows, then columns, each copied into a strip with 20 zeros either side.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) P[20 + x] = F[y * W + x];
    for (let x = 0; x < W; x++) {
      const c = 20 + x;
      let s = K[0] * P[c];
      for (let i = 1; i <= rad; i++) s += K[i] * (P[c - i] + P[c + i]);
      G[y * W + x] = s;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) P[20 + y] = G[y * W + x];
    for (let y = 0; y < H; y++) {
      const c = 20 + y, p = y * W + x;
      let s = K[0] * P[c];
      for (let i = 1; i <= rad; i++) s += K[i] * (P[c - i] + P[c + i]);
      V[p] = (s + g * U[p]) / LAM;
    }
  }
  if (S.bnd > 0) sides(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const V = S.V, F = S.F, sd = S.side, c = S.c, hp = 0.07 + S.hue, hn = 0.7 + 0.06 * sin(2 * PI * S.hue);
  const ch = S.bnd > 0 ? min(1, 3 * S.bnd) : 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, v = V[p], L = Math.round(v), e = v - L, ae = abs(e);
      // On a level line: a neighbour lies across the nearest level and is no
      // nearer to it. The chord is drawn two LEDs wide, on both sides.
      let z = 0, q, n = -1;
      if (x > 0 && ((q = V[p - 1] - L), q * e < 0) && abs(q) >= ae) n = p - 1;
      else if (x < W - 1 && ((q = V[p + 1] - L), q * e < 0) && abs(q) >= ae) n = p + 1;
      else if (y > 0 && ((q = V[p - W] - L), q * e < 0) && abs(q) >= ae) n = p - W;
      else if (y < H - 1 && ((q = V[p + W] - L), q * e < 0) && abs(q) >= ae) n = p + W;
      if (n >= 0) z = L === 0 ? 2 : 1;
      if (ch) {
        const o = 3 - sd[p];
        if (o < 3 && ((x > 0 && sd[p - 1] === o) || (x < W - 1 && sd[p + 1] === o) || (y > 0 && sd[p - W] === o) || (y < H - 1 && sd[p + W] === o))) z = 3;
      }
      // Relief: the fine field lit from the upper left.
      const u = ((x > 0 ? F[p - 1] : 0) - (x < W - 1 ? F[p + 1] : 0) + (y > 0 ? F[p - W] : 0) - (y < H - 1 ? F[p + W] : 0)) * 0.8, sh = (0.35 * u) / (1 + abs(u));
      const t = 1 - exp(-abs(v) / 1.5);
      if (z === 3) hsv(hp + 0.1 + 0.03 * sh, 0.04 + 0.1 * abs(sh), 1, c);
      else if (z === 2) hsv(hp + 0.05 + 0.04 * sh, 0.05 + 0.12 * abs(sh) + 0.35 * ch, 1 - 0.35 * ch, c);
      else if (v > 0) {
        // Above zero the brightest channel stays at full. Each band of
        // height LAM steps the hue from amber toward gold and pales it; the
        // relief turns hue and saturation a little inside the band.
        const b = min(L - (e < 0 ? 1 : 0), 3);
        hsv(hp + 0.04 * b + 0.02 * (v - b) + 0.05 * sh - (z ? 0.025 : 0), 0.8 - 0.1 * b + 0.5 * sh, z ? 0.86 + 0.3 * sh : 1, c);
      } else hsv(hn + 0.08 * t + 0.12 * sh, 0.85 - 0.3 * t, z ? 0.3 * (1 + sh) : (0.16 - 0.04 * t) * (1 + 1.8 * sh), c);
      display.setPixel(x, y, min(255, c[0]) | 0, min(255, c[1]) | 0, min(255, c[2]) | 0);
    }
}
