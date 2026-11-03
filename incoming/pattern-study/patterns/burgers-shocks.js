// ===== Patternflow pattern =====
// Title:   Burgers Shocks
// Family:  sim
// Idea:    A spacetime diagram of the Burgers equation on a ring of 64 LEDs, solved exactly from a random smooth starting velocity: time runs down all 128 rows, the fluid particles draw coloured threads from where they started until they run into a shock, then stick to it and ride along, so the shocks gather mass and merge downward into a bright tree, drawn row by row by a falling front over the last diagram before a new random field takes over.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Burgers equation (Johannes Martinus Burgers, 1948); its exact solution through the Hopf-Cole transformation (Eberhard Hopf, 1950; Julian Cole, 1951) and its inviscid limit, a minimum over starting points (the Lax-Oleinik formula); the adhesion model, in which matter sticks inside shocks (Sergei Gurbatov, Alexander Saichev and Sergei Shandarin, 1989), here in one dimension beside Zeldovich Pancakes (round 40); pattern round 101
// Round:   101
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Kicks=0..3, Viscosity=0..1
//
// Knob 1: Hue. Turns the palette round the wheel. At 0 the threads run from teal (particles that started at the left and right edges) through azure to violet (those that started in the middle), and the shocks are cream; at 0.5 the threads run red to yellow-green and the shocks are pale blue.
// Knob 2: Speed. At 2 the front falls 20 rows a second, so a diagram takes 6.4 s, holds whole for 1.6 s, and the next one starts at the top; ten times slower at 0.2 and half as fast again at 3. The panel opens on a whole diagram in its hold.
// Knob 3: Kicks. At 0 (the opening) the flow only decays: over ten random fields the first shocks appear on rows 7 to 9, about 11 stand on rows 16 to 24, 6 on row 64, and 1 to 4 trunks (2.6 on average) reach the bottom. 1, 2 or 3 add that many sudden random pushes on evenly spaced rows (32, 64 and 96 at 3): every thread and trunk bends at once on a kick row, the trunks zigzag and run together sooner, and 1.3 trunks on average reach the bottom at 3.
// Knob 4: Viscosity. Below 0.15 the shocks are true jumps, worked out from the convex hull; above it the Hopf-Cole integral is summed with viscosity 0.3 x Viscosity^2. The largest shock on the bottom row holds 80% of its mass within 2 LEDs at the opening 0.06, about 5 at 0.5, 10 at 0.75 and 14 at 1, where the weak shocks never form and the tree turns into soft bands.

// u_t + u u_x = nu u_xx on a ring of 64 LEDs, x in LEDs. Write u = dPhi/dx.
// Without viscosity Phi(x, t) = min over y of Phi0(y) + (x - y)^2 / (2t),
// and the fluid at (x, t) started at the minimising y, with u = (x - y) / t.
// Expanding the square, that y is where the line of slope x / t touches the
// lower convex hull of Phi0(y) + y^2 / (2t): a starting point on the hull
// is a free particle on its straight characteristic y + u0(y) t, and every
// starting point under one edge of the hull sits in one shock, at t times
// the slope of that edge. That is the adhesion model, exact for any field.
// With viscosity, Phi = -2 nu log psi and psi solves the heat equation
// (Hopf, Cole), so the starting point is a Gibbs average of y with weights
// exp(-(Phi0(y) + (x - y)^2 / (2t)) / (2 nu)), summed directly.
//
// Time grows as the square of the row, from 0 at the top to 320 at the
// bottom: shocks are born early and merge ever more slowly, and this gives
// each generation of mergers its share of the height. On that axis a free
// particle's straight path is half a parabola.
//
// The starting velocity is 24 sine waves with random phases, amplitudes
// falling as k^-0.25 and a mean of zero, so Phi0 is periodic. Each LED is
// given the interval of starting points it holds under a tent filter: its
// mass. In a fan between shocks the mass is below 1 and the LED stays dim;
// a shock holds tens of LEDs' worth of fluid in one, and lights cream by the
// log of its mass. Threads are the particles that started at every other
// LED centre, coloured by that place.
//
// A kick adds a random potential on its row: Phi and the starting point of
// every place are worked out there on a grid of 1/16 LED and the next stretch
// starts from them, so particles keep their colour and shocks their mass.

const W = 64, H = 128, N = W * H, G = 16, NG = W * G, KM = 24, SP = 2;
const { floor, ceil, round, sqrt, cos, log, exp, abs, min, max, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const NU_HULL = 0.00675;
// Rows a second at Speed 1, seconds of hold at Speed 1.
const RATE = 10, HOLD = 3.2;
const TEXP = 2, TMAX = 320;
const TIME = (r) => TMAX * Math.pow(r / H, TEXP);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A random zero-mean potential on the fine grid whose velocity has the given
// rms, from wave kLo to KM.
function randomPotential(rms, kLo) {
  const amp = [], ph = [];
  let e = 0;
  for (let k = kLo; k <= KM; k++) {
    const a = (0.45 + 0.55 * Math.random()) * Math.pow(k, -0.25);
    amp.push(a);
    ph.push(Math.random() * 2 * PI);
    e += (a * a) / 2;
  }
  const sc = rms / sqrt(e), P = new Float64Array(NG);
  for (let j = 0; j < NG; j++) {
    const y = j / G;
    let v = 0;
    for (let i = 0; i < amp.length; i++) {
      const k = kLo + i, w = (2 * PI * k) / W;
      v -= ((amp[i] * sc) / w) * cos(w * y + ph[i]);
    }
    P[j] = v;
  }
  return P;
}

function speedOf(P) {
  let m = 0;
  for (let j = 0; j < NG; j++) m = max(m, abs(P[(j + 1) % NG] - P[j]) * G);
  return m;
}

function newField(kicks) {
  const F = {
    base: randomPotential(0.2, 1),
    kick: [randomPotential(0.3, 1), randomPotential(0.3, 1), randomPotential(0.3, 1)],
    lab: new Float32Array(N),
    sig: new Float32Array(N),
    val: new Float32Array(N),
    rows: 0,
  };
  setKicks(F, kicks);
  return F;
}

function setKicks(F, kicks) {
  F.kicks = kicks;
  F.bound = [];
  for (let s = 0; s <= kicks + 1; s++) F.bound.push(round((H * s) / (kicks + 1)));
  const q = new Float64Array(NG);
  for (let j = 0; j < NG; j++) q[j] = j / G;
  F.stages = [{ P: F.base, Q: q, um: speedOf(F.base) }];
  F.rows = 0;
}

// Potential and starting point at fine index j, any integer.
function pAt(st, j) {
  return st.P[((j % NG) + NG) % NG];
}
function qAt(st, j) {
  const m = ((j % NG) + NG) % NG;
  return st.Q[m] + W * ((j - m) / NG);
}

// Inviscid: for sorted xs, the starting point (into outQ) and the potential
// (into outP, if given) after time tau from stage st, by the lower hull.
const HJ = new Int32Array(8192), HV = new Float64Array(8192);
function solveHull(st, tau, xs, n, outQ, outP) {
  const D = st.um * tau + 1;
  const jlo = floor((xs[0] - D) * G), jhi = ceil((xs[n - 1] + D) * G);
  let m = 0;
  for (let j = jlo; j <= jhi; j++) {
    const y = j / G, v = pAt(st, j) + (y * y) / (2 * tau);
    while (m >= 2) {
      const y0 = HJ[m - 2] / G, y1 = HJ[m - 1] / G;
      if ((y1 - y0) * (v - HV[m - 2]) - (HV[m - 1] - HV[m - 2]) * (y - y0) > 0) break;
      m--;
    }
    HJ[m] = j;
    HV[m] = v;
    m++;
  }
  let h = 0;
  for (let i = 0; i < n; i++) {
    const s = xs[i] / tau;
    while (h < m - 1 && (HV[h + 1] - HV[h]) * G < s * (HJ[h + 1] - HJ[h])) h++;
    outQ[i] = qAt(st, HJ[h]);
    if (outP) {
      const d = xs[i] - HJ[h] / G;
      outP[i] = pAt(st, HJ[h]) + (d * d) / (2 * tau);
    }
  }
}

// Viscous: the same through the Hopf-Cole sum.
function solveGibbs(st, tau, nu, xs, n, outQ, outP) {
  const D = st.um * tau + sqrt(40 * nu * tau) + 0.5;
  const step = cl(round((sqrt(nu * tau) / 3) * G), 1, 16), inv = 1 / (2 * nu);
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const jlo = ceil((x - D) * G), jhi = floor((x + D) * G);
    let e0 = Infinity;
    for (let j = jlo; j <= jhi; j += step) {
      const d = x - j / G, e = pAt(st, j) + (d * d) / (2 * tau);
      if (e < e0) e0 = e;
    }
    let sw = 0, sq = 0;
    for (let j = jlo; j <= jhi; j += step) {
      const d = x - j / G, a = (pAt(st, j) + (d * d) / (2 * tau) - e0) * inv;
      if (a > 18) continue;
      const w = exp(-a);
      sw += w;
      sq += w * qAt(st, j);
    }
    outQ[i] = sq / sw;
    if (outP) outP[i] = e0 - 2 * nu * log(sw);
  }
}

const FINE = new Float64Array(NG);
for (let j = 0; j < NG; j++) FINE[j] = j / G;

function ensureStage(F, s, nu) {
  if (F.stages[s]) return F.stages[s];
  const prev = ensureStage(F, s - 1, nu), tau = TIME(F.bound[s]) - TIME(F.bound[s - 1]);
  const P = new Float64Array(NG), Q = new Float64Array(NG);
  if (nu < NU_HULL) solveHull(prev, tau, FINE, NG, Q, P);
  else solveGibbs(prev, tau, nu, FINE, NG, Q, P);
  const K = F.kick[s - 1];
  for (let j = 0; j < NG; j++) P[j] += K[j];
  const st = { P, Q, um: speedOf(P) };
  F.stages[s] = st;
  return st;
}

// The starting point at every half LED, 0 to 64, of one row.
const XS = new Float64Array(129), LQ = new Float64Array(129), THR = new Float32Array(W), MS = new Float64Array(W), SH = new Float64Array(W);
for (let i = 0; i <= 128; i++) XS[i] = i / 2;

function computeRow(F, r, nu) {
  let s = 0;
  while (r >= F.bound[s + 1]) s++;
  const st = ensureStage(F, s, nu), tau = TIME(r + 0.5) - TIME(F.bound[s]);
  if (nu < NU_HULL) solveHull(st, tau, XS, 128, LQ);
  else solveGibbs(st, tau, nu, XS, 128, LQ);
  LQ[128] = LQ[0] + W;
  const L = (i) => (i < 0 ? LQ[i + 128] - W : i > 128 ? LQ[i - 128] + W : LQ[i]);
  // Threads: starting points SP n + 0.5, placed by inverse interpolation.
  THR.fill(0);
  for (let i = 0; i < 128; i++) {
    const a = LQ[i], b = LQ[i + 1];
    if (b <= a) continue;
    for (let k = ceil((a - 0.5) / SP); SP * k + 0.5 < b; k++) {
      const q = SP * k + 0.5;
      if (q < a) continue;
      const px = XS[i] + (0.5 * (q - a)) / (b - a) - 0.5, x0 = floor(px), f = px - x0;
      THR[(x0 + W) % W] += 1 - f;
      THR[(x0 + 1 + W) % W] += f;
    }
  }
  // Mass of each LED under the tent filter, and how bright a shock it is.
  for (let x = 0; x < W; x++) {
    const c = 2 * x + 1;
    MS[x] = 0.25 * L(c + 2) + 0.5 * L(c + 1) - 0.5 * L(c - 1) - 0.25 * L(c - 2);
    SH[x] = cl(0.36 * Math.log2(max(MS[x], 1e-6)) - 0.12, 0, 0.92);
  }
  const o = r * W;
  for (let x = 0; x < W; x++) {
    const m = MS[x], c = 2 * x + 1;
    // A shock holding three LEDs' worth or more lights its neighbours too, so
    // the trunks thicken as they merge.
    const halo = 0.42 * max(0, max(SH[(x + W - 1) % W], SH[(x + 1) % W]) - 0.5);
    const v = 0.07 + 0.06 * cl(m, 0, 1) + 0.5 * min(THR[x], 1) + SH[x] + halo;
    const q = (((L(c) % W) + W) % W) / W;
    F.lab[o + x] = q < 0.5 ? 2 * q : 2 - 2 * q;
    F.sig[o + x] = max(cl((m - 1.4) / 4, 0, 1), cl(halo * 4, 0, 1));
    F.val[o + x] = min(v, 1);
  }
}

function fill(F, upto, nu) {
  while (F.rows < upto) computeRow(F, F.rows++, nu);
}

export function setup(params) {
  params.s = { t: 0, hue: 0, speed: 2, kicks: 0, nu: 0, A: null, B: null, front: 0, hold: 0 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  const kicks = cl(floor(k[2] == null ? 0 : k[2]), 0, 3);
  const vis = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.nu = 0.3 * vis * vis;
  if (!S.A) {
    // The panel opens on a whole diagram, held, before the first front.
    S.kicks = kicks;
    S.A = S.B = newField(kicks);
    fill(S.B, H, S.nu);
    S.front = H;
  }
  if (kicks !== S.kicks) {
    S.kicks = kicks;
    const n = S.B.rows;
    setKicks(S.B, kicks);
    fill(S.B, n, S.nu);
  }
  if (S.front < H) {
    S.front = min(H, S.front + d * S.speed * RATE);
  } else {
    S.hold += (d * S.speed) / HOLD;
    if (S.hold >= 1) {
      S.hold = 0;
      S.front = 0;
      S.A = S.B;
      S.B = newField(S.kicks);
    }
  }
  fill(S.B, min(H, ceil(S.front)), S.nu);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.A) return;
  const f = S.front, h0 = S.hue + 0.47, hs = S.hue + 0.11;
  for (let y = 0; y < H; y++) {
    const fresh = y < f, F = fresh ? S.B : S.A;
    // The rows the front has just drawn glow, the old diagram below is dimmed
    // and paled.
    const age = f - y;
    const glow = fresh && f < H ? cl(1 - (age - 1) / 4, 0, 1) : 0;
    const dim = fresh ? 1 : 0.68, pale = fresh ? 1 : 0.5;
    for (let x = 0; x < W; x++) {
      const p = y * W + x, sg = F.sig[p];
      let v = F.val[p] * dim;
      if (glow > 0) v = min(1, v * (1 + 1.2 * glow));
      const a = hsv(h0 + 0.3 * F.lab[p], 0.85 * pale * (1 - 0.6 * glow) * cl(0.3 + 3 * v, 0, 1), v);
      const b = hsv(hs, 0.38 * pale * (1 - glow), v);
      display.setPixel(x, y, round((a[0] + (b[0] - a[0]) * sg) * 255), round((a[1] + (b[1] - a[1]) * sg) * 255), round((a[2] + (b[2] - a[2]) * sg) * 255));
    }
  }
}
