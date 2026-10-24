// ===== Patternflow pattern =====
// Title:   Bi-Phase
// Family:  cosmetic
// Idea:    The panel is the inside of a two-phase cleanser just shaken: tinted oil drops in pale water merge into bigger round drops, the big ones rise fastest, and the oil gathers on top in one layer under a bright meniscus line until the bottle is shaken again.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 30, after two-phase cleansers and phase-field separation of two liquids (Cahn-Hilliard, John W. Cahn and John E. Hilliard, 1958; Allen-Cahn, Samuel M. Allen and John W. Cahn, 1979)
// Round:   30
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Oil=0.3..0.6, Shake=0..1
//
// Knob 1: Hue. Turns the oil round the colour wheel; the water stays a pale cool white. At 0 the oil is peach, at 0.25 green, at 0.5 sky blue, at 0.75 violet and at 0.85 rose.
// Knob 2: Speed. How fast the liquid runs. At 2 a drop of radius 3 rises 14 LEDs a second and one of radius 8 35, and the oil has settled into its layer 6 to 7 s after a shake; at 0.2 everything, the shake too, takes ten times as long.
// Knob 3: Oil. The share of the bottle that is oil, 30% to 60%. At 0.3 the meniscus settles 38 LEDs from the top and a shake makes oil drops in water; past 0.5 it makes water drops in oil, and at 0.6 the line settles 77 LEDs down.
// Knob 4: Shake. How hard and how often the bottle is shaken. At 0 every 23 s at Speed 2, into drops of radius 2.2 to 5 LEDs, and the layers stand calm for most of that; at 1 every 5 s, into drops of radius 1.5 to 2.4 that rise slowly, so the oil never quite settles.
// Buttons: K1 tap shakes the bottle now.

const W = 64, H = 128, N = W * H;
// The flow is solved on a coarse grid of 4x4 LED cells.
const CW = 16, CH = 32, CN = CW * CH;
const { min, max, floor, sqrt, sin, cos, exp, log, tanh, abs, PI, random } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Allen-Cahn: phi_t = M (K lap phi + phi - phi^3) + lambda, phi = +1 oil and
// -1 water, lambda the multiplier that holds the amount of oil to K3. The
// interface is tanh(d / sqrt(2K)) across, about 2 LEDs, and moves at M K
// times its curvature. h M (8K + 2) < 2 keeps the step stable: 4 a frame at
// Speed 2.
const KAP = 0.5, MOB = 1.5, HMAX = 0.21;
// Gravity in the free energy, on the interfaces only: a rim higher up gains
// oil from one lower down in the same patch.
const GRAV = 2.5;
// Time units a second at Speed 1; a shake lasts TS of them, 1.1 s at Speed 2.
const RATE = 12, TS = 26;
// The push of the oil, and the screening of the flat bottle's walls.
const BUOY = 0.5, AL2 = 0.16;
// Drops under AMAX LEDs move as one piece; ROUND and DRIFT below.
const AMAX = 700, ROUND = 0.06, DRIFT = 0.08;

// Sine transforms of the coarse grid (DST-II forward, DST-III back), and the
// screened Stokes operator (lap - a^2)^2 psi = d(f_y)/dx of a flat cell,
// diagonal in that basis, with free-slip walls.
const SX = new Float32Array(CW * CW), SY = new Float32Array(CH * CH), KI = new Float32Array(CN);
for (let m = 0; m < CW; m++) for (let i = 0; i < CW; i++) SX[m * CW + i] = sin((PI * (m + 1) * (i + 0.5)) / CW);
for (let n = 0; n < CH; n++) for (let j = 0; j < CH; j++) SY[n * CH + j] = sin((PI * (n + 1) * (j + 0.5)) / CH);
for (let n = 0; n < CH; n++)
  for (let m = 0; m < CW; m++) {
    const kx = 4 * sin((PI * (m + 1)) / (2 * CW)) ** 2, ky = 4 * sin((PI * (n + 1)) / (2 * CH)) ** 2;
    KI[n * CW + m] = ((m === CW - 1 ? 1 : 2) * (n === CH - 1 ? 1 : 2)) / (CN * (kx + ky + AL2) ** 2);
  }

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const c = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  (o[0] = c[0]), (o[1] = c[1]), (o[2] = c[2]);
}

export function setup(params) {
  params.s = null;
}

function init(k) {
  const f = () => new Float32Array(N), g = () => new Float32Array(CN);
  const P = {
    phi: f(), nxt: f(), S: f(), tmp: f(), blur: f(), u: f(), v: f(), b1: f(), b2: f(),
    lab: new Int32Array(N), stk: new Int32Array(N), cu: f(), cv: f(), ca: f(), px: f(), py: f(), rad: f(),
    F: g(), A: g(), G: g(), psi: g(), U: g(), V: g(),
    hue: k[0], speed: 2, oil: cl(k[2], 0.3, 0.6), shake: cl(k[3], 0, 1),
    mT: 0, c: 0.85 * TS, time: 0, rt: 0, deep: [0, 0, 0], pale: [0, 0, 0],
  };
  // Open at the end of a shake, the new drops just formed.
  P.mT = 2 * P.oil - 1;
  shake(P);
  P.phi.set(P.S);
  for (let s = 0; s < 8; s++) relax(P, HMAX);
  return P;
}

// A shake's emulsion: round drops of the lesser liquid dropped at random until
// they make up its share, radius 2.2 to 5 LEDs after a gentle shake and 1.5
// to 2.4 after a hard one, small ones the most common. Most land a LED clear
// of the others; one in twenty may touch.
function shake(P) {
  const S = P.S, inv = P.mT > 0, f = inv ? (1 - P.mT) / 2 : (1 + P.mT) / 2;
  const r0 = 2.2 - 0.7 * P.shake, r1 = 5 - 2.6 * P.shake;
  S.fill(-1);
  let area = 0;
  for (let k = 0; k < 5000 && area < f * N; k++) {
    const r = r0 * (r1 / r0) ** (random() ** 1.6), cx = random() * W, cy = random() * H;
    const xa = max(0, floor(cx - r - 2)), xb = min(W - 1, floor(cx + r + 2)), ya = max(0, floor(cy - r - 2)), yb = min(H - 1, floor(cy + r + 2));
    if (k < 4500 && random() < 0.95) {
      let hit = false;
      const rr = (r + 1.2) * (r + 1.2);
      for (let y = ya; y <= yb && !hit; y++)
        for (let x = xa; x <= xb; x++) {
          const ex = x + 0.5 - cx, ey = y + 0.5 - cy;
          if (ex * ex + ey * ey < rr && S[y * W + x] > -0.9) hit = true;
        }
      if (hit) continue;
    }
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const ex = x + 0.5 - cx, ey = y + 0.5 - cy, i = y * W + x, v = tanh((r - sqrt(ex * ex + ey * ey)) / 0.8);
        if (v > S[i]) (area += (v - S[i]) / 2), (S[i] = v);
      }
  }
  if (inv) for (let i = 0; i < N; i++) S[i] = -S[i];
}

// Box blur of radius r, along x and then y, by running sums.
function box(src, dst, tmp, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let s = src[o] * (r + 1);
    for (let x = 1; x <= r; x++) s += src[o + x];
    for (let x = 0; x < W; x++) (tmp[o + x] = s / n), (s += src[o + min(x + r + 1, W - 1)] - src[o + max(x - r, 0)]);
  }
  for (let x = 0; x < W; x++) {
    let s = tmp[x] * (r + 1);
    for (let y = 1; y <= r; y++) s += tmp[y * W + x];
    for (let y = 0; y < H; y++) (dst[y * W + x] = s / n), (s += tmp[min(y + r + 1, H - 1) * W + x] - tmp[max(y - r, 0) * W + x]);
  }
}

// One Allen-Cahn step. The multiplier acts on the interfaces only, weighted
// by g = (1 - phi^2)^2, and is worked out over each 11x11 patch rather than
// the whole panel, so what a drop's rim loses to its curvature comes back on
// the same rim: a drop pulls round without shrinking, oil cannot go into
// solution in the water, and a drop only feeds a neighbour it nearly touches,
// as with Cahn-Hilliard. What the patches miss goes back over all the rims.
function relax(P, h) {
  const phi = P.phi, r = P.nxt, g = P.b1, rb = P.b2, gb = P.blur, a = h * MOB;
  for (let y = 0; y < H; y++) {
    const up = y > 0 ? -W : 0, dn = y < H - 1 ? W : 0, gr = (GRAV * (H - 2 * y)) / H;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = phi[i], q = 1 - p * p, w = q * q;
      const lap = phi[x > 0 ? i - 1 : i] + phi[x < W - 1 ? i + 1 : i] + phi[i + up] + phi[i + dn] - 4 * p;
      r[i] = a * (KAP * lap + p - p * p * p + gr * w);
      g[i] = w;
    }
  }
  box(r, rb, P.tmp, 5);
  box(g, gb, P.tmp, 5);
  let sum = 0, gs = 0;
  for (let i = 0; i < N; i++) {
    const q = (phi[i] += r[i] - (g[i] * rb[i]) / (gb[i] + 1e-9));
    sum += q;
    gs += g[i];
  }
  const d = (P.mT * N - sum) / (gs + 1e-6);
  for (let i = 0; i < N; i++) phi[i] += d * g[i];
}

// The flow. Oil is lighter, so each coarse cell pushes up by how much oil it
// holds; screened Stokes flow carries the drops, big ones faster, and water
// comes down round them. A shake adds a swirl of the two lowest modes.
function flow(P, swirl, phase) {
  const { phi, F, A, G, psi, U, V } = P;
  F.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) F[(y >> 2) * CW + (x >> 2)] += phi[y * W + x];
  // The curl of the push, -B dF/dx, then along x, along y, scaled, and back.
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) G[j * CW + i] = (-BUOY / 32) * (F[j * CW + min(i + 1, CW - 1)] - F[j * CW + max(i - 1, 0)]);
  for (let j = 0; j < CH; j++)
    for (let m = 0; m < CW; m++) {
      let s = 0;
      for (let i = 0; i < CW; i++) s += G[j * CW + i] * SX[m * CW + i];
      A[j * CW + m] = s;
    }
  for (let n = 0; n < CH; n++)
    for (let m = 0; m < CW; m++) {
      let s = 0;
      for (let j = 0; j < CH; j++) s += A[j * CW + m] * SY[n * CH + j];
      G[n * CW + m] = s * KI[n * CW + m];
    }
  for (let j = 0; j < CH; j++)
    for (let m = 0; m < CW; m++) {
      let s = 0;
      for (let n = 0; n < CH; n++) s += G[n * CW + m] * SY[n * CH + j];
      A[j * CW + m] = s;
    }
  const c1 = cos(phase), s1 = sin(phase);
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      let s = 0;
      for (let m = 0; m < CW; m++) s += A[j * CW + m] * SX[m * CW + i];
      const X = (PI * (i + 0.5)) / CW, Y = (PI * (j + 0.5)) / CH;
      psi[j * CW + i] = s + swirl * (sin(X) * sin(2 * Y) * c1 + 0.8 * sin(2 * X) * sin(Y) * s1);
    }
  // u = dpsi/dy, v = -dpsi/dx, in LEDs per time unit; psi is 0 past the walls.
  for (let j = 0; j < CH; j++)
    for (let i = 0; i < CW; i++) {
      const k = j * CW + i, p = psi[k];
      U[k] = 2 * ((j < CH - 1 ? psi[k + CW] : -p) - (j > 0 ? psi[k - CW] : -p));
      V[k] = -2 * ((i < CW - 1 ? psi[k + 1] : -p) - (i > 0 ? psi[k - 1] : -p));
    }
}

// The flow at every LED. A drop of either liquid under AMAX LEDs moves as one
// piece at the mean of the flow over it, as surface tension holds a small
// drop together, and so do the two rings of LEDs round it, which it is about
// to take the place of. On top of that each drop is drawn towards the circle
// of its own area: every LED of it moves along the radius at ROUND times its
// distance from that circle, which curvature alone would take seconds over
// for a big drop. A drop on a side wall slides up it and is drawn to a half
// circle standing on the wall. Every drop rises, or sinks if it is water, at
// least DRIFT LEDs a time unit faster than the coarse flow says, so the last
// small ones still get there. The layers and the liquid between the drops
// follow the flow smoothed over 5 LEDs; during a shake the swirl takes over.
function velocity(P, rigid) {
  const { U, V, u, v, b1, b2, phi, lab, stk, cu, cv, ca, px, py, rad } = P;
  for (let y = 0; y < H; y++) {
    const gy = cl((y - 1.5) / 4, 0, CH - 1), j0 = gy | 0, fy = gy - j0, a = j0 * CW, b = min(j0 + 1, CH - 1) * CW;
    for (let x = 0; x < W; x++) {
      const gx = cl((x - 1.5) / 4, 0, CW - 1), i0 = gx | 0, i1 = min(i0 + 1, CW - 1), fx = gx - i0, i = y * W + x;
      u[i] = (U[a + i0] * (1 - fx) + U[a + i1] * fx) * (1 - fy) + (U[b + i0] * (1 - fx) + U[b + i1] * fx) * fy;
      v[i] = (V[a + i0] * (1 - fx) + V[a + i1] * fx) * (1 - fy) + (V[b + i0] * (1 - fx) + V[b + i1] * fx) * fy;
    }
  }
  box(u, b1, P.tmp, 2);
  box(v, b2, P.tmp, 2);
  if (rigid <= 0) return u.set(b1), v.set(b2);
  // Label the pieces of each liquid, 4-connected.
  lab.fill(-1);
  let nc = 0;
  for (let s = 0; s < N; s++) {
    if (lab[s] >= 0) continue;
    const ph = phi[s] > 0;
    let top = 0, area = 0, su = 0, sv = 0, mx = 0, my = 0, wall = false;
    stk[top++] = s;
    lab[s] = nc;
    while (top > 0) {
      const i = stk[--top], x = i % W;
      area++;
      if (x === 0 || x === W - 1) wall = true;
      (su += u[i]), (sv += v[i]), (mx += x), (my += (i - x) / W);
      if (x > 0 && lab[i - 1] < 0 && phi[i - 1] > 0 === ph) (lab[i - 1] = nc), (stk[top++] = i - 1);
      if (x < W - 1 && lab[i + 1] < 0 && phi[i + 1] > 0 === ph) (lab[i + 1] = nc), (stk[top++] = i + 1);
      if (i >= W && lab[i - W] < 0 && phi[i - W] > 0 === ph) (lab[i - W] = nc), (stk[top++] = i - W);
      if (i < N - W && lab[i + W] < 0 && phi[i + W] > 0 === ph) (lab[i + W] = nc), (stk[top++] = i + W);
    }
    (ca[nc] = area), (cu[nc] = wall ? 0 : su / area), (cv[nc] = sv / area + (ph ? -DRIFT : DRIFT));
    (px[nc] = wall ? (mx / area < W / 2 ? -0.5 : W - 0.5) : mx / area), (py[nc] = my / area);
    rad[nc] = sqrt(((wall ? 2 : 1) * area) / PI);
    nc++;
  }
  const put = (i, k) => {
    const dx = (i % W) - px[k], dy = ((i / W) | 0) - py[k], w = ROUND * (rad[k] / (sqrt(dx * dx + dy * dy) + 0.5) - 1);
    (u[i] = cu[k] + w * dx), (v[i] = cv[k] + w * dy), (lab[i] = k);
  };
  let top = 0;
  for (let i = 0; i < N; i++) {
    if (ca[lab[i]] < AMAX) put(i, lab[i]), (stk[top++] = i);
    else (u[i] = b1[i]), (v[i] = b2[i]), (lab[i] = -1);
  }
  // Two rings round each drop, nearest drop first.
  for (let ring = 0, from = 0; ring < 2; ring++) {
    const end = top;
    for (let t = from; t < end; t++) {
      const i = stk[t], x = i % W, k = lab[i];
      if (x > 0 && lab[i - 1] < 0) put(i - 1, k), (stk[top++] = i - 1);
      if (x < W - 1 && lab[i + 1] < 0) put(i + 1, k), (stk[top++] = i + 1);
      if (i >= W && lab[i - W] < 0) put(i - W, k), (stk[top++] = i - W);
      if (i < N - W && lab[i + W] < 0) put(i + W, k), (stk[top++] = i + W);
    }
    from = end;
  }
  if (rigid < 1) for (let i = 0; i < N; i++) (u[i] = b1[i] + (u[i] - b1[i]) * rigid), (v[i] = b2[i] + (v[i] - b2[i]) * rigid);
}

// Semi-Lagrangian advection of a field over T time units, from src into dst.
// Past the top the bottle holds oil (top) and past the bottom water (bot), so
// a drop leaving the floor does not draw a streak of itself up behind it.
function advect(P, src, dst, T, top, bot) {
  const { u, v } = P;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, sx = cl(x - u[i] * T, 0, W - 1), sy = y - v[i] * T;
      const x0 = sx | 0, x1 = min(x0 + 1, W - 1), ex = sx - x0, y0 = floor(sy), ey = sy - y0;
      const a = y0 < 0 ? top : y0 > H - 1 ? bot : src[y0 * W + x0] * (1 - ex) + src[y0 * W + x1] * ex;
      const b = y0 < -1 ? top : y0 > H - 2 ? bot : src[(y0 + 1) * W + x0] * (1 - ex) + src[(y0 + 1) * W + x1] * ex;
      dst[i] = a * (1 - ey) + b * ey;
    }
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0.3, 0.06];
  if (!params.s) params.s = init(k);
  const P = params.s, d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.oil = cl(k[2], 0.3, 0.6);
  P.shake = cl(k[3], 0, 1);
  // The amount of oil follows K3 at a fifth of the bottle a second, so the
  // layer grows or thins instead of the water clouding over.
  P.mT += cl(2 * P.oil - 1 - P.mT, -0.4 * d, 0.4 * d);
  const T = d * P.speed * RATE;
  P.rt += d;
  P.time += T;
  P.c += T;
  // A shake every 560 time units (23 s at Speed 2) at K4 0, down to 120 at 1.
  if ((input.btnPressed && input.btnPressed[0] && P.c > TS) || P.c > 560 - 440 * sqrt(P.shake)) (P.c = 0), shake(P);
  // The swirl winds the liquid round for the first two thirds of a shake, and
  // as it dies the liquid breaks up into the new drops.
  const shaking = P.c < TS, u = P.c / TS, e = shaking ? sin(PI * min(1, u / 0.65)) ** 2 : 0;
  flow(P, 10 * e, P.time * 0.3);
  velocity(P, 1 - e);
  // phi is carried as atanh(phi), which runs nearly straight through an
  // interface, so the linear interpolation does not smear the drops' edges.
  const phi = P.phi, q = P.nxt;
  for (let i = 0; i < N; i++) {
    const p = cl(phi[i], -0.99999, 0.99999);
    q[i] = 0.5 * log((1 + p) / (1 - p));
  }
  advect(P, q, phi, T, 6, -6);
  for (let i = 0; i < N; i++) phi[i] = 1 - 2 / (exp(2 * phi[i]) + 1);
  if (shaking) {
    const w = 1 - exp(-0.5 * sm(0.4, 0.8, u) * T), S = P.S;
    for (let i = 0; i < N; i++) phi[i] += w * (S[i] - phi[i]);
  }
  const steps = Math.ceil(T / HMAX - 1e-6);
  for (let s = 0; s < steps; s++) relax(P, T / steps);
  // A drop shrunk to one LED inside the other liquid cannot go anywhere under
  // the local multiplier and would stay as a dimple: fill it in.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = phi[i];
      if (p > 0.97 || p < -0.97) continue;
      const a = phi[x > 0 ? i - 1 : i + 1], b = phi[x < W - 1 ? i + 1 : i - 1], c = phi[y > 0 ? i - W : i + W], e = phi[y < H - 1 ? i + W : i - W];
      const lo = min(a, b, c, e), hi = max(a, b, c, e);
      if ((lo > 0.5 && p < lo - 0.1) || (hi < -0.5 && p > hi + 0.1)) phi[i] = (a + b + c + e) / 4;
    }
}

// Light from the upper left and in front, and the half vector for the glint.
const LX = -0.42, LY = -0.56, LZ = 0.71, HN = Math.hypot(LX, LY, LZ + 1), HX = LX / HN, HY = LY / HN, HZ = (LZ + 1) / HN;

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const phi = P.phi, bl = P.blur, deep = P.deep, pale = P.pale;
  // phi blurred over 5x5 is read as the height of the oil: a drop is a dome
  // and the layer a plateau, lit from the upper left.
  box(phi, bl, P.tmp, 2);
  hsv(P.hue + 0.07, 0.62, 1, deep);
  hsv(P.hue + 0.07, 0.26, 1, pale);
  // A soft band of shop light drifts across the glass every 14 s.
  const band = W / 2 + 46 * sin((2 * PI * P.rt) / 14);
  for (let y = 0; y < H; y++) {
    const shop = 0.86 + 0.14 * (1 - y / H);
    // Water: a pale cool white, a shade bluer low down.
    const wr = 0.76 - 0.06 * (y / H), wg = 0.82 - 0.03 * (y / H), wb = 0.93;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, p = phi[i], o = sm(-0.6, 0.6, p);
      const gx = phi[x < W - 1 ? i + 1 : i] - phi[x > 0 ? i - 1 : i], gy = phi[y < H - 1 ? i + W : i] - phi[y > 0 ? i - W : i];
      const nx = -2.4 * (bl[x < W - 1 ? i + 1 : i] - bl[x > 0 ? i - 1 : i]), ny = -2.4 * (bl[y < H - 1 ? i + W : i] - bl[y > 0 ? i - W : i]);
      const nn = 1 / sqrt(nx * nx + ny * ny + 1), c1 = max(0, (nx * HX + ny * HY + HZ) * nn), c4 = c1 * c1 * c1 * c1, c16 = c4 * c4 * c4 * c4;
      // Oil: pale at a drop's rim and deep in its middle and in the layer,
      // shaded as a dome, never below 80% so it does not go brown.
      const dpt = sm(-0.2, 0.9, bl[i]), sh = max(0.8, 1 + 0.6 * ((nx * LX + ny * LY + LZ) * nn - LZ));
      const r = wr + ((pale[0] + (deep[0] - pale[0]) * dpt) * sh - wr) * o;
      const g = wg + ((pale[1] + (deep[1] - pale[1]) * dpt) * sh - wg) * o;
      const b = wb + ((pale[2] + (deep[2] - pale[2]) * dpt) * sh - wb) * o;
      // The rim catches the light from above, a dome its glint, and a long
      // flat interface, the meniscus, shows as a bright line.
      const q = 1 - p * p, rim = q * q, lit = cl(gy * 0.6 + gx * 0.25, 0, 1), flat = (gy * gy) / (gx * gx + gy * gy + 1e-6);
      const men = rim * flat * flat * sm(0.45, 0.75, abs(ny / 2.4));
      const bx = (x - band + 0.4 * (y - H / 2)) / 11, sheen = bx * bx < 9 ? exp(-bx * bx) * (0.05 + 0.1 * o) : 0;
      const hl = cl(0.1 * rim + 0.45 * rim * lit + 0.7 * c16 * c16 * o + 0.8 * men + sheen, 0, 1);
      display.setPixel(x, y, (r + (1 - r) * hl) * shop * 255, (g + (1 - g) * hl) * shop * 255, (b + (1 - b) * hl) * shop * 255);
    }
  }
}
