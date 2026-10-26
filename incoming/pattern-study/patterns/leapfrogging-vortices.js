// ===== Patternflow pattern =====
// Title:   Leapfrogging Vortices
// Family:  sim
// Idea:    Two smoke rings travel up the panel one behind the other, seen in a slice through their axis as two pairs of dye spirals, and the rear ring keeps shrinking, darting through the front one and widening again while the front one swells, slows and falls behind.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: leapfrogging vortex rings (Hermann von Helmholtz, 1858), as two pairs of point vortices (Walter Gröbli, 1877; A. E. H. Love, 1894), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ratio=3..8, Dye=0..1
//
// Knob 1: Hue. Turns both dyes round the wheel together: at 0 the ring that starts in front is emerald and the one behind it magenta.
// Knob 2: Speed. At 2 a whole leapfrog, each ring passing through the other once, takes 7.9 seconds at the start ratio and the pair climbs 67 LEDs in it; at 0.2 ten times slower.
// Knob 3: Ratio. How many times wider the big ring is than the small one at the moment the small one passes through it. At 3 the rings leapfrog every 7.9 seconds; at 5 every 41, drifting up to 53 LEDs apart between passes. Love's threshold is 1 / (3 - 2 sqrt 2) = 5.83. From about 5.6 the rings part further than the panel before they turn back, and above 5.83 the small ring darts through once and walks away for good; either way a fresh pair is launched.
// Knob 4: Dye. How much dye fills the rings' bubbles of water: at the start the spirals in the cores and a thin wake; turned up, two full smoke rings and a long braided wake.
// Buttons: K1 tap lays fresh dye on both rings.

// Each ring is a pair of point vortices of circulation G in the plane
// through the axis, one on each side, spinning opposite ways. A ring is the
// same all round its axis, so only the right-hand vortex of each pair is
// integrated and its mirror image across the axis carries -G. The slice is
// four point vortices, and the motion is the one Gröbli and Love worked
// out: when the small pair passes through the big one, if it is wider than
// 3 - 2 sqrt 2 = 0.17157 of the big one the two keep leapfrogging, and if it
// is narrower they part. The threshold is where the energy of the four
// vortices at that moment equals the most that two pairs far apart can
// have with the same impulse, so above it they can never get far apart.
//
// Checked in a separate run (G = 1, the big pair's half width 1, both
// level at the start, RK4): at 0.17157 the pairs walked away, 2000 apart at
// t = 1.3e6; at 0.1716 they came level again at t = 38545, at 0.172 at 2433,
// at 0.175 at 297. Near the threshold that half period grows as
// 1 / (ratio - 0.17157). Integrating all four vortices with no mirror
// imposed and one nudged by 1e-9, the leapfrog broke its mirror symmetry at
// every ratio up to 0.38 (at 0.3 by t = 62) and held from 0.385, as Acheson
// (2000) found with 0.382. A ring that stays round cannot do that, hence the
// mirror. With this file's integrator over 600 seconds at Speed 2 the energy
// of the four vortices drifted by 2.6e-12 of itself and the impulse along the
// axis by 3e-14, at every ratio from 3 to 5.5.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, abs, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = () => Math.random();
// The big ring's half width when the small one is level with it, in LEDs;
// circulation per vortex in LED^2 per second at Speed 2, divided by 2 pi;
// the panel row the rings' middle is held on; dye particles per ring
// (right half, drawn mirrored); the separation at which a pair is replaced.
const A = 22, GAM = 820, G = GAM / (2 * PI), ROW = 52, NPR = 2600, LIM = 104;
// The vortex step, and the longest dye step, in seconds.
const HV = 0.004, HD = 0.018;
// Dye brightness: density scale, and the share under which dye is only haze.
const S0 = 2.2, D0 = 0.06;
const JIT = new Uint8Array(N).map((_, p) => h32(p, 77) & 63);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
function h32(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// Velocity of the two right-hand vortices (x, y up) from the other three.
const K1 = new Float64Array(4), K2 = new Float64Array(4), K3 = new Float64Array(4), K4 = new Float64Array(4), TV = new Float64Array(4);
function vvel(V, o) {
  for (let k = 0; k < 2; k++) {
    const x = V[2 * k], y = V[2 * k + 1], j = 2 - 2 * k, xj = V[j], dy = y - V[j + 1];
    const dx = x - xj, r1 = dx * dx + dy * dy, ex = x + xj, r2 = ex * ex + dy * dy;
    o[2 * k] = G * (dy / r1 - dy / r2);
    o[2 * k + 1] = G * (0.5 / x - dx / r1 + ex / r2);
  }
}
function vstep(V, h) {
  vvel(V, K1);
  for (let i = 0; i < 4; i++) TV[i] = V[i] + 0.5 * h * K1[i];
  vvel(TV, K2);
  for (let i = 0; i < 4; i++) TV[i] = V[i] + 0.5 * h * K2[i];
  vvel(TV, K3);
  for (let i = 0; i < 4; i++) TV[i] = V[i] + h * K3[i];
  vvel(TV, K4);
  for (let i = 0; i < 4; i++) V[i] += (h / 6) * (K1[i] + 2 * K2[i] + 2 * K3[i] + K4[i]);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    V: new Float64Array(4), V0: new Float64Array(4), Vm: new Float64Array(4),
    yc: 0, ratio: -1, want: 3, wait: 0, go: 0, gain: 1,
    hue: -1, dye: 0.06, d2: 4, nact: NPR,
    px: F(2 * NPR), py: F(2 * NPR), age: F(2 * NPR), life: F(2 * NPR), pt: [0, 0], pp: [0, 0],
    M: F(2 * N), M2: F(2 * N), DA: F(N), DB: F(N), col: F(6),
  };
}

// Dye. Each ring has NL particles that are laid as straight lines across
// its core, half of them every PULSE seconds, so each line lives two pulses
// and winds into a spiral, the inside turning faster than the outside. The
// rest fill the ring's bubble of water; what the rings shed of it trails
// behind as the wake, and comes back into a bubble when it leaves the panel.
const NL = 360, CL = NL / 2, PULSE = 1.3;
function line(S, k) {
  const V = S.V, a = V[2 * k], R = 0.62 * a, th = rnd() * PI, c = cos(th), s = sin(th), par = (S.pp[k] ^= 1);
  for (let m = 0; m < CL; m++) {
    const i = k * NPR + 2 * m + par, r = R * (((m + 0.5) / CL) * 2 - 1);
    S.px[i] = abs(a + r * c);
    S.py[i] = V[2 * k + 1] + r * s;
    S.age[i] = 0;
    S.life[i] = 2 * PULSE;
  }
}
function bubble(S, i, spread) {
  const k = i < NPR ? 0 : 1, V = S.V, a = V[2 * k];
  let x, y;
  do (x = rnd()), (y = 2 * rnd() - 1);
  while (x * x + y * y > 1);
  S.px[i] = 1.5 * a * x;
  S.py[i] = V[2 * k + 1] + 1.8 * a * y;
  S.age[i] = spread ? -0.5 * rnd() : 0;
  S.life[i] = 9 + 12 * rnd();
}

// A fresh pair: level with the small ring inside the big one, then run
// backwards until the small one is furthest behind (or LIM / 2 behind, if
// they would part for good), so it shrinks and darts through first.
function launch(S, ratio) {
  const V = S.V;
  V[0] = A, V[1] = 0, V[2] = A / ratio, V[3] = 0;
  let last = 0;
  for (let t = 0; t < 60; t += HV * 4) {
    vstep(V, -HV * 4);
    const sep = abs(V[1] - V[3]);
    if (sep < last || sep > LIM * 0.42) break;
    last = sep;
  }
  const m = (V[1] + V[3]) / 2;
  V[1] += S.yc - m, V[3] += S.yc - m;
  S.ratio = ratio;
  fresh(S);
  // A second and a bit, so the first lines are already spirals.
  for (let i = 0; i < 70; i++) advance(S, HD);
}

function fresh(S) {
  for (let k = 0; k < 2; k++) {
    S.pt[k] = PULSE * (0.5 + 0.5 * k);
    S.age.fill(9, k * NPR, k * NPR + NL);
    line(S, k);
    for (let i = k * NPR + NL; i < (k + 1) * NPR; i++) bubble(S, i, 1);
  }
}

// Velocity of the water at (x, y), each core a disc of radius sqrt(d2)
// turning as a solid body; outside it the same as a point vortex.
let U = 0, VY = 0;
function flow(x, y, V, d2) {
  let u = 0, v = 0;
  for (let k = 0; k < 4; k += 2) {
    const xk = V[k], dy = y - V[k + 1], dx = x - xk, ex = x + xk;
    let r = dx * dx + dy * dy;
    if (r < d2) r = d2;
    let q = ex * ex + dy * dy;
    if (q < d2) q = d2;
    u += dy / r - dy / q;
    v += ex / q - dx / r;
  }
  U = G * u;
  VY = G * v;
}

function advance(S, h) {
  const { V, V0, Vm, px, py, age, life, nact, d2 } = S;
  V0.set(V);
  const n = Math.max(1, Math.round(h / 2 / HV)), hv = h / 2 / n;
  for (let i = 0; i < n; i++) vstep(V, hv);
  Vm.set(V);
  for (let i = 0; i < n; i++) vstep(V, hv);
  for (let k = 0; k < 2; k++) if ((S.pt[k] -= h) <= 0) (S.pt[k] += PULSE), line(S, k);
  for (let i = 0; i < 2 * NPR; i++) {
    const j = i < NPR ? i : i - NPR;
    if (j >= nact) continue;
    if (j >= NL && ((age[i] += h) > life[i] || py[i] < S.yc + ROW - H - 3 || px[i] > 36)) {
      bubble(S, i, 0);
      continue;
    }
    if (j < NL) age[i] += h;
    const x = px[i], y = py[i];
    flow(x, y, V0, d2);
    const u1 = U, v1 = VY;
    flow(x + 0.5 * h * u1, y + 0.5 * h * v1, Vm, d2);
    const u2 = U, v2 = VY;
    flow(x + 0.5 * h * u2, y + 0.5 * h * v2, Vm, d2);
    const u3 = U, v3 = VY;
    flow(x + h * u3, y + h * v3, V, d2);
    px[i] = abs(x + (h / 6) * (u1 + 2 * u2 + 2 * u3 + U));
    py[i] = y + (h / 6) * (v1 + 2 * v2 + 2 * v3 + VY);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3), want = cl(k[2], 3, 8);
  S.dye = cl(k[3], 0, 1);
  S.nact = NL + Math.round((NPR - NL) * (0.25 + 0.75 * S.dye));
  if (S.ratio < 0) launch(S, want), (S.want = want);
  if (abs(want - S.want) > 0.01) (S.want = want), (S.wait = 0.3);
  if (S.wait > 0 && (S.wait -= d) <= 0 && !S.go) S.go = 0.5;
  const p = input.btnPressed || [];
  if (p[0]) fresh(S);
  // Rings that have parted beyond the panel make way for a fresh pair.
  if (!S.go && abs(S.V[1] - S.V[3]) > LIM) S.go = 0.5;
  if (S.go) {
    S.gain = S.go / 0.5;
    if ((S.go -= d) <= 0) (S.go = 0), launch(S, S.want), (S.gain = 0);
  } else S.gain = min(1, S.gain + d / 0.5);
  const h = (d * sp) / 2, n = Math.ceil(h / HD - 1e-9);
  // Heights are kept within a few thousand LEDs of the start.
  if (S.yc > 4096) {
    (S.V[1] -= 4096), (S.V[3] -= 4096), (S.yc -= 4096);
    for (let i = 0; i < 2 * NPR; i++) S.py[i] -= 4096;
    for (let i = 1; i < 2 * N; i += 2) S.M[i] -= 4096;
  }
  const yc0 = S.yc;
  if (!S.mset) {
    S.mset = 1;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) (S.M[2 * (j * W + i)] = i - 31.5), (S.M[2 * (j * W + i) + 1] = yc0 + ROW - j - 0.5);
  }
  for (let i = 0; i < n; i++) advance(S, h / n);
  S.yc = (S.V[1] + S.V[3]) / 2;
  water(S, h, yc0);
}

// The water carries fine glitter that catches the light sheet, too faint to
// light an LED. Each LED keeps the place its water came from (M), carried
// back along the flow every frame, and shows the glitter of that place, so
// still water slides down past the rings and the water they carry turns.
function water(S, h, yc0) {
  const { V, M, M2, d2 } = S;
  for (let j = 0; j < H; j++) {
    const y = S.yc + ROW - j - 0.5;
    for (let i = 32; i < W; i++) {
      const x = i - 31.5;
      flow(x, y, V, d2);
      for (let s = 0; s < 2; s++) {
        const X = s ? -x : x, u = s ? -U : U, xb = X - h * u, yb = y - h * VY;
        const fx = xb + 31.5, fy = yc0 + ROW - yb - 0.5, o = 2 * (j * W + (s ? 63 - i : i));
        if (fx < 0 || fx > W - 1 || fy < 0 || fy > H - 1) {
          M2[o] = xb, M2[o + 1] = yb;
          continue;
        }
        const ix = floor(fx), iy = floor(fy), ax = fx - ix, ay = fy - iy, q = 2 * (iy * W + ix), q2 = q + (ix < W - 1 ? 2 : 0), q3 = q + (iy < H - 1 ? 2 * W : 0), q4 = q3 + (ix < W - 1 ? 2 : 0);
        for (let c = 0; c < 2; c++) M2[o + c] = (M[q + c] * (1 - ax) + M[q2 + c] * ax) * (1 - ay) + (M[q3 + c] * (1 - ax) + M[q4 + c] * ax) * ay;
      }
    }
  }
  S.M = M2, S.M2 = M;
}

function splat(D, x, y, w) {
  const fx = x - 0.5, fy = y - 0.5, ix = floor(fx), iy = floor(fy);
  if (ix < -1 || ix >= W || iy < -1 || iy >= H) return;
  const ax = fx - ix, ay = fy - iy;
  if (iy >= 0) {
    if (ix >= 0) D[iy * W + ix] += w * (1 - ax) * (1 - ay);
    if (ix < W - 1) D[iy * W + ix + 1] += w * ax * (1 - ay);
  }
  if (iy < H - 1) {
    if (ix >= 0) D[(iy + 1) * W + ix] += w * (1 - ax) * ay;
    if (ix < W - 1) D[(iy + 1) * W + ix + 1] += w * ax * ay;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || S.ratio < 0) return;
  const { px, py, age, life, DA, DB, col, M, nact } = S;
  hsv(S.hue + 0.4, 0.55, 1, col, 0);
  hsv(S.hue + 0.86, 0.5, 1, col, 3);
  DA.fill(0), DB.fill(0);
  for (let i = 0; i < 2 * NPR; i++) {
    const j = i < NPR ? i : i - NPR;
    if (j >= nact) continue;
    const a = age[i], w = (j < NL ? min(1, a / 0.5, (life[i] - a) / 0.6) : 0.22 * min(1, a / 0.5, (life[i] - a) / 2)) * min(1, 0.5 + px[i]);
    if (w <= 0) continue;
    const y = ROW + S.yc - py[i], D = i < NPR ? DA : DB;
    splat(D, 32 + px[i], y, w), splat(D, 32 - px[i], y, w);
  }
  const gain = S.gain, cA0 = col[0], cA1 = col[1], cA2 = col[2], cB0 = col[3], cB1 = col[4], cB2 = col[5];
  for (let p = 0; p < N; p++) {
    // The glitter of the water this LED shows, never past 24, and a fixed
    // flicker of a level or two per LED under it.
    const g = h32(floor(M[2 * p] + 64), floor(M[2 * p + 1]) & 4095), q = JIT[p];
    let r = (((g & 31) * 22) >> 5) + (q & 3), gg = ((((g >> 5) & 31) * 22) >> 5) + ((q >> 2) & 3), b = ((((g >> 10) & 31) * 22) >> 5) + ((q >> 4) & 3);
    const a = DA[p], c = DB[p], s = a + c;
    if (s > 0.01) {
      const D = gain * (1 - exp(-s / S0)), u = a / s, c0 = cB0 + (cA0 - cB0) * u, c1 = cB1 + (cA1 - cB1) * u, c2 = cB2 + (cA2 - cB2) * u;
      if (D < D0) {
        // Thin dye is a haze in the water that stays under the LEDs' threshold.
        const t = (0.7 * D) / D0;
        (r += (24 * c0 - r) * t), (gg += (24 * c1 - gg) * t), (b += (24 * c2 - b) * t);
      } else {
        const v = 28 + 227 * ((D - D0) / (1 - D0)) ** 0.45, e = 2.4;
        (r = v * c0 + (r - 12) * e), (gg = v * c1 + (gg - 12) * e), (b = v * c2 + (b - 12) * e);
      }
    }
    display.setPixel(p & 63, p >> 6, cl(r, 0, 255) | 0, cl(gg, 0, 255) | 0, cl(b, 0, 255) | 0);
  }
}
