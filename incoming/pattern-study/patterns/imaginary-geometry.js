// ===== Patternflow pattern =====
// Title:   Imaginary Geometry
// Family:  noise
// Idea:    Thirteen flow lines of a drifting Gaussian free field leave one point on the bottom edge as a fan of angles and climb to one point on the top edge, each turning wherever the field turns it, so a line of larger angle always stays to the left, and where two come within an LED they run on together as one and part again without ever crossing.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: imaginary geometry, the flow lines of the Gaussian free field (Jason Miller and Scott Sheffield, 2016); Gaussian Free Field (round 52) draws the same field's level lines, this one its flow lines, pattern round 55
// Round:   55
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Kappa=0.5..3, Spread=4..6.2
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the lines run from magenta on the left (the largest angle) through violet and blue to cyan on the right, with white marks where a line joins another for four LEDs or more. Behind them the direction a line of angle 0 would take at each LED shows as a faint hue, 22 of 255 in its brightest channel; that faint wheel skips orange and yellow, which read brown and olive so dark.
// Knob 2: Speed. How fast the field drifts. Each of its 2,048 sine modes is a smooth random process whose law stays the free field's: at 2 the largest mode forgets itself in 1.5 s and the finest, 4 LEDs from crest to crest, in 0.24 s. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Kappa. The SLE parameter. It sets chi = 2/sqrt(kappa) - sqrt(kappa)/2, from 2.47 at 0.5 to 0.29 at 3, and the lines turn by the field divided by chi. At 0.5 they wobble round a lens 37 LEDs wide at mid-height and ride on another line for 7% of their length, at 1 for 19%. At 2 they braid into one winding bundle 26 LEDs wide, riding together 42% of the way, and at 3 into a ribbon 11 LEDs wide, 55%. The field is smoothed over 1.2 LEDs up to kappa 1.55, then over a width that grows to 4.1 LEDs at 3, so that a line's turning stays near 0.6 radians per LED, root mean square, and the line stays a line.
// Knob 4: Spread. The fan of angles, in radians: thirteen lines evenly from -2 to +2 at 4, up to -3.1 to +3.1 at 6.2. At kappa 0.5 the lens is 37 LEDs wide at mid-height at 4 and 57 at 6.2, where the outermost lines hug the side edges: a line whose angle reached pi would run along the bottom edge.
// Buttons: K1 tap draws a new field, and the fan grows from the bottom point again over about a second.

const W = 64, H = 128, NX = W + 1, NY = H + 1, NN = NX * NY;
const { floor, min, max, abs, sqrt, sin, cos, exp, log, atan2, hypot, PI } = Math;
const TAU = 2 * PI, HALF = PI / 2;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Lines, sine modes across and up, and points a line may hold.
const NL = 13, MM = 32, NM = 64, MAXP = 3000;
// The root on the bottom edge and the target on the top, both at x = 32.
// Positions are in LEDs with v measured up from the bottom edge, and the
// field lives on the 65 x 129 nodes at the LED corners.
const RX = 32;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The field is h0 + lambda U + chi V. h0 is the free field, zero on the
// edges. lambda U carries the boundary values -lambda left of the root and
// +lambda right of it that make the angle-0 line from root to target an
// SLE(kappa), with lambda = pi / sqrt(kappa). chi V is the coordinate change
// h o phi - chi arg phi' from the half-plane: V is the boundary's own
// turning, 0 along the bottom, pi/2 up the sides and pi along the top,
// minus on the left. U and V jump at the root and the target, so each is
// split into those jumps, written out (argR, argT), and a smooth rest
// solved once on the nodes.
const argR = (u, v) => atan2(v, u - RX);
const argT = (u, v) => (v >= H ? (u >= RX ? 0 : -PI) : atan2(v - H, u - RX));

// Laplace's equation inside, the edge nodes held: over-relaxed sweeps.
function harmonic(F) {
  const om = 2 / (1 + sin(PI / NY));
  for (let it = 0; it < 4000; it++) {
    let worst = 0;
    for (let j = 1; j < H; j++)
      for (let i = 1; i < W; i++) {
        const p = j * NX + i, d = om * (0.25 * (F[p - 1] + F[p + 1] + F[p - NX] + F[p + NX]) - F[p]);
        F[p] += d;
        if (abs(d) > worst) worst = abs(d);
      }
    if (worst < 1e-7) break;
  }
}

// Sine modes of the 64 x 128 rectangle. With the free field's covariance
// -log|x - y|, mode (m, n) has standard deviation sqrt(2 pi / mu) on the
// orthonormal basis, mu being its eigenvalue. TC is its time constant in
// seconds at Speed 1: 3 s for the largest, down as mu^-1/4.
const SXT = new Float64Array(MM * NX), SYT = new Float64Array(NM * NY);
for (let m = 0; m < MM; m++) for (let i = 0; i < NX; i++) SXT[m * NX + i] = sin((PI * (m + 1) * i) / W);
for (let n = 0; n < NM; n++) for (let j = 0; j < NY; j++) SYT[n * NY + j] = sin((PI * (n + 1) * j) / H);
const MU = new Float64Array(MM * NM), AMP = new Float64Array(MM * NM), TC = new Float64Array(MM * NM);
for (let m = 0; m < MM; m++)
  for (let n = 0; n < NM; n++) {
    const q = m * NM + n, mu = PI * PI * (((m + 1) / W) ** 2 + ((n + 1) / H) ** 2);
    MU[q] = mu;
    AMP[q] = sqrt((2 * PI) / mu) * (2 / sqrt(W * H));
    TC[q] = 3 * (MU[0] / mu) ** 0.25;
  }

function gauss() {
  const a = Math.random() || 1e-12, b = Math.random();
  return sqrt(-2 * log(a)) * cos(TAU * b);
}

export function setup(params) {
  const SU = new Float64Array(NN), SV = new Float64Array(NN);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      if (i > 0 && i < W && j > 0 && j < H) continue;
      const p = j * NX + i;
      let ud, vd;
      if (j === 0) (ud = i < RX ? -1 : i > RX ? 1 : 0), (vd = i === 0 ? -PI / 4 : i === W ? PI / 4 : 0);
      else if (j === H) (ud = i < RX ? -1 : i > RX ? 1 : 0), (vd = i === 0 ? (-3 * PI) / 4 : i === W ? (3 * PI) / 4 : i < RX ? -PI : i > RX ? PI : 0);
      else if (i === 0) (ud = -1), (vd = -HALF);
      else (ud = 1), (vd = HALF);
      const at = argT(i, j), aR = j === 0 ? ud : 1 - (2 / PI) * argR(i, j);
      // The two ends themselves take the rest's limit there, which is 0.
      const end = i === RX && (j === 0 || j === H);
      SU[p] = end ? 0 : ud - aR - (1 + (2 / PI) * at);
      SV[p] = end ? 0 : vd - (PI + 2 * at);
    }
  harmonic(SU);
  harmonic(SV);
  // The jumps at the nodes too, for the look-up away from the two ends.
  const AR = new Float64Array(NN), AV = new Float64Array(NN);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const p = j * NX + i, at = argT(i, j);
      AR[p] = 2 + (2 / PI) * (at - argR(i, j));
      AV[p] = PI + 2 * at;
    }
  const K = MM * NM, X = new Float64Array(K), Y = new Float64Array(K);
  for (let q = 0; q < K; q++) (X[q] = gauss()), (Y[q] = gauss() / TC[q]);
  params.s = {
    SU, SV, AR, AV, X, Y, C: new Float64Array(K), B: new Float64Array(MM * NY), h: new Float64Array(NN), P: new Float64Array(NN), F: new Float64Array(NN),
    own: new Int16Array(W * H), pts: Array.from({ length: NL }, () => new Float32Array(MAXP * 2)), vis: Array.from({ length: NL }, () => new Uint8Array(MAXP)), np: new Int32Array(NL),
    jx: new Float32Array(40), jy: new Float32Array(40), nj: 0,
    rgb: new Float32Array(W * H * 3), col: new Float64Array(3), pal: new Float32Array(192), palHue: -1,
    t: 0, hue: 0, speed: 2, kappa: 0.5, spread: 4, chi: 1, lc: 1, eps: 1,
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.5, 4], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.kappa = cl(kv[2], 0.5, 3);
  S.spread = cl(kv[3], 4, 6.2);
  if (input.btnPressed && input.btnPressed[0]) {
    for (let q = 0; q < S.X.length; q++) (S.X[q] = gauss()), (S.Y[q] = gauss() / TC[q]);
    S.t = 0;
  }
  S.t += d;
  const rk = sqrt(S.kappa);
  S.chi = 2 / rk - rk / 2;
  // lambda / chi = 2 pi / (4 - kappa): how far the boundary values turn a line.
  S.lc = PI / rk / S.chi;
  // A line turns by the gradient of h / chi, whose spread is 1 / (sqrt 2 eps
  // chi) for a field smoothed over eps: eps keeps that near 0.6 rad per LED,
  // and never under 1.2 LEDs, where the finest modes run out.
  S.eps = max(1.2, 1 / (sqrt(2) * S.chi * 0.6));
  // Each mode is a critically damped oscillator driven by noise: its path is
  // smooth, so the lines glide, and its law stays the unit normal.
  const de = d * S.speed, X = S.X, Y = S.Y;
  for (let q = 0; q < X.length; q++) {
    const tc = TC[q];
    Y[q] += (-2 * Y[q] / tc - X[q] / (tc * tc)) * de + (2 / (tc * sqrt(tc))) * sqrt(de) * gauss();
    X[q] += Y[q] * de;
  }
  const C = S.C, e2 = (S.eps * S.eps) / 2, kmax2 = 4.6 / e2;
  let mTop = 0;
  for (let m = 0; m < MM; m++)
    for (let n = 0; n < NM; n++) {
      const q = m * NM + n;
      if (MU[q] > kmax2) {
        C[q] = 0;
        continue;
      }
      C[q] = AMP[q] * exp(-MU[q] * e2) * X[q];
      if (m + 1 > mTop) mTop = m + 1;
    }
  // Mode k is even or odd about the middle as k is odd or even, so each sum
  // serves a node and its mirror.
  const B = S.B, h = S.h;
  for (let m = 0; m < mTop; m++)
    for (let j = 0; j <= H / 2; j++) {
      let e = 0, o = 0;
      for (let n = 0; n < NM; n += 2) {
        e += C[m * NM + n] * SYT[n * NY + j];
        o += C[m * NM + n + 1] * SYT[(n + 1) * NY + j];
      }
      B[m * NY + j] = e + o;
      B[m * NY + H - j] = e - o;
    }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i <= W / 2; i++) {
      let e = 0, o = 0;
      for (let m = 0; m < mTop; m += 2) {
        e += SXT[m * NX + i] * B[m * NY + j];
        if (m + 1 < mTop) o += SXT[(m + 1) * NX + i] * B[(m + 1) * NY + j];
      }
      h[j * NX + i] = e + o;
      h[j * NX + W - i] = e - o;
    }
  // P is the angle field without the jumps at the ends, F with them.
  const P = S.P, F = S.F, ic = 1 / S.chi, lc = S.lc;
  for (let p = 0; p < NN; p++) {
    P[p] = h[p] * ic + lc * S.SU[p] + S.SV[p];
    F[p] = P[p] + lc * S.AR[p] + S.AV[p];
  }
  trace(S);
}

// h / chi at a point: the angle a line of angle 0 turns from north. Within
// 6 LEDs of either end the jumps are written out instead of interpolated.
function phiAt(S, u, v) {
  const fu = cl(u, 0, W - 1e-6), fv = cl(v, 0, H - 1e-6), i = floor(fu), j = floor(fv), a = fu - i, b = fv - j, p = j * NX + i;
  if ((u - RX) ** 2 + v * v > 36 && (u - RX) ** 2 + (v - H) ** 2 > 36) {
    const F = S.F;
    return (F[p] * (1 - a) + F[p + 1] * a) * (1 - b) + (F[p + NX] * (1 - a) + F[p + NX + 1] * a) * b;
  }
  const P = S.P, rest = (P[p] * (1 - a) + P[p + 1] * a) * (1 - b) + (P[p + NX] * (1 - a) + P[p + NX + 1] * a) * b;
  const at = argT(u, min(v, H));
  return rest + S.lc * (2 + (2 / PI) * (at - argR(u, max(v, 0)))) + PI + 2 * at;
}

// Each line follows exp(i (h / chi + theta)) from the root, by midpoint steps
// of half an LED that shorten near the ends. The middle line goes first and
// the rest pair off outward. A line that steps into an LED an earlier line
// holds rides with it, undrawn, until it steps into a free LED again. In the
// smoothed field two lines of different angle cannot even touch, since they
// would cross with the larger angle going right; in the free field itself
// lines whose angles differ by less than pi kappa / (4 - kappa) do touch
// and bounce off. Drawn at one LED, both look like this.
function trace(S) {
  const own = S.own, grow = S.t < 2.5 ? 180 * S.t : 1e9, lc = S.lc, sp = S.spread, mid = (NL - 1) / 2;
  own.fill(0);
  S.nj = 0;
  for (let k = 0; k <= mid; k++)
    for (const L of k ? [mid + k, mid - k] : [mid]) {
      const th = -sp / 2 + (sp * L) / (NL - 1), pts = S.pts[L], vis = S.vis[L], id = L + 1;
      // Near the root the field is the half-plane's alone, and the line of
      // angle theta leaves along the one ray it maps to itself.
      const a0 = (HALF + th + lc) / (1 + (2 * lc) / PI);
      let u = RX + cos(a0), v = sin(a0), n = 0, len = 0, ride = false, ju = 0, jv = 0, rc = 0;
      (vis[n] = 1), (pts[2 * n] = RX), (pts[2 * n++ + 1] = 0);
      (vis[n] = 1), (pts[2 * n] = u), (pts[2 * n++ + 1] = v);
      let ci = floor(u), cj = floor(H - v);
      while (n < MAXP) {
        const rr = hypot(u - RX, v), rt = hypot(u - RX, v - H), s = cl(0.15 * min(rr, rt), 0.05, 0.5);
        let f = HALF + th + phiAt(S, u, v);
        f = HALF + th + phiAt(S, u + 0.5 * s * cos(f), v + 0.5 * s * sin(f));
        u += s * cos(f);
        v += s * sin(f);
        len += s;
        if (rt < 0.8 || u < 0.05 || u > W - 0.05 || v < 0.05 || v > H - 0.05 || len > grow) break;
        const ni = floor(u), nj = floor(H - v);
        if (ni !== ci || nj !== cj) {
          let o = own[nj * W + ni];
          if (ni !== ci && nj !== cj) {
            // A diagonal step: the side LED nearer the path counts too, so
            // two lines cannot slip past each other through a corner.
            const sx = abs(u - max(ni, ci)) < abs(H - v - max(nj, cj)) ? ci : ni, sy = sx === ci ? nj : cj, os = own[sy * W + sx];
            if (os && os !== id) o = o || os;
            else if (!o && rr > 3.5) own[sy * W + sx] = id;
          }
          // The lines all leave the root together, so the first 3.5 LEDs are shared.
          const held = rr > 3.5 && o && o !== id;
          if (held && !ride) (ju = u), (jv = v), (rc = 0);
          if (held && ++rc === 4 && S.nj < 40) (S.jx[S.nj] = ju), (S.jy[S.nj++] = jv);
          ride = held;
          if (!held) own[nj * W + ni] = id;
          (ci = ni), (cj = nj);
        }
        vis[n] = ride ? 0 : 1;
        (pts[2 * n] = u), (pts[2 * n++ + 1] = v);
      }
      S.np[L] = n;
    }
}

// Lines are laid as points every third of an LED, each lighting its four
// nearest LEDs by how close it falls; an LED keeps the brightest.
function plot(S, x, y, c, a) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy), tx = fx - ix, ty = fy - iy, rgb = S.rgb;
  for (let dy = 0; dy < 2; dy++) {
    const yy = iy + dy;
    if (yy < 0 || yy >= H) continue;
    const wy = dy ? ty : 1 - ty;
    for (let dx = 0; dx < 2; dx++) {
      const xx = ix + dx;
      if (xx < 0 || xx >= W) continue;
      const w = min(1, (dx ? tx : 1 - tx) * wy * 1.7) * a, p = (yy * W + xx) * 3;
      if (rgb[p] < c[0] * w) rgb[p] = c[0] * w;
      if (rgb[p + 1] < c[1] * w) rgb[p + 1] = c[1] * w;
      if (rgb[p + 2] < c[2] * w) rgb[p + 2] = c[2] * w;
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, col = S.col, pal = S.pal, F = S.F;
  // The faint wheel runs from lime round through blue and magenta to red,
  // leaving out orange and yellow.
  if (S.palHue !== S.hue) {
    for (let k = 0; k < 64; k++) {
      const fh = k / 64 + S.hue;
      hsv(0.22 + 0.8 * (fh - floor(fh)), 0.6, 0.088, col);
      (pal[3 * k] = col[0]), (pal[3 * k + 1] = col[1]), (pal[3 * k + 2] = col[2]);
    }
    S.palHue = S.hue;
  }
  for (let r = 0, o = 0; r < H; r++)
    for (let c = 0; c < W; c++, o += 3) {
      const p = (H - 1 - r) * NX + c, f = (F[p] + F[p + 1] + F[p + NX] + F[p + NX + 1]) / (4 * TAU), q = 3 * ((64 * (f - floor(f))) | 0);
      (rgb[o] = pal[q]), (rgb[o + 1] = pal[q + 1]), (rgb[o + 2] = pal[q + 2]);
    }
  // Line colours go round half the wheel by angle, cyan to magenta at 0.
  const c = [0, 0, 0];
  for (let L = 0; L < NL; L++) {
    const pts = S.pts[L], vis = S.vis[L], n = S.np[L];
    hsv(0.45 + S.hue + (0.45 * L) / (NL - 1), 0.8, 1, c);
    for (let k = 0; k + 1 < n; k++) {
      if (!vis[k + 1]) continue;
      const xa = pts[2 * k], ya = H - pts[2 * k + 1], xb = pts[2 * k + 2], yb = H - pts[2 * k + 3];
      const m = Math.ceil(hypot(xb - xa, yb - ya) * 3) || 1;
      for (let e = 0; e < m; e++) plot(S, xa + ((xb - xa) * e) / m, ya + ((yb - ya) * e) / m, c, 1);
    }
  }
  const white = [1, 1, 1];
  for (let k = 0; k < S.nj; k++) plot(S, S.jx[k], H - S.jy[k], white, 0.85);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, (255 * cl(rgb[p], 0, 1)) | 0, (255 * cl(rgb[p + 1], 0, 1)) | 0, (255 * cl(rgb[p + 2], 0, 1)) | 0);
}
