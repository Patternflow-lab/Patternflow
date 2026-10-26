// ===== Patternflow pattern =====
// Title:   Sinai's Walk
// Family:  noise
// Idea:    A random potential runs down the panel as a jagged ridge, one site to a row and each site with its own coin for a step up or down; 3,000 walkers start on one row of this one landscape and run on a clock of log t, so a pool fills every valley to depth log t and rises steadily while the walkers glow in the pool that holds them, stay there until it spills over a ridge into a deeper valley, then pour over together, until they gather in the deepest valley on the panel and a fresh landscape is drawn.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: random walk in a random environment (Fred Solomon, 1975), Sinai's walk and its (log t)^2 law (Yakov Sinai, 1982), the walkers' localization in one valley (Andrei Golosov, 1984), the transient walk X_t ~ t^kappa (Harry Kesten, M. V. Kozlov and Frank Spitzer, 1975), the valleys of depth h as h-extrema (Jacques Neveu and Jim Pitman, 1989), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Bias=0..1, Disorder=1.2..2.4
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 each valley's ground has its own shade between azure and violet, the valley holding the walkers a fifth brighter, the pools are cyan with a bright surface line and the walkers pale gold; at 0.5 the ground runs rose to magenta, the pools are pink and the walkers pale blue. The wheel skips orange to lime, which reads brown on the dim ground.
// Knob 2: Speed. How fast log t runs: 1 a second at 2, so a walker has taken 19 steps after 3 seconds, 2,980 after 8 and 162,750 after 12; 0.1 a second at 0.2 and 1.5 at 3. A run ends 4.5 units of log t after the walkers' valley first reaches the deepest point of the panel, at log t 9.7 for the median landscape at the opening Disorder, then holds 1.8 seconds.
// Knob 3: Bias. 0 is Sinai's recurrent walk: log rho = log((1 - omega)/omega) has mean 0, the walkers start on row 64 and the potential wanders with no slope. Above 0 the mean of log rho is -Bias x Disorder^2 / 2, which makes E[rho^kappa] = 1 at kappa = Bias exactly; the ridge leans, the start moves up to row 4 by Bias 0.25, and the walkers go down the panel a trap at a time as Kesten, Kozlov and Spitzer's X_t ~ t^kappa. At Bias 0.5 and Disorder 1.2 the median walker on an open line is 100 sites out after 10,000 steps and 4,420 after 10 million.
// Knob 4: Disorder. sigma, the spread of log rho at each site, 1.2 to 2.4. The ridge draws V at 2.6 columns a unit, narrower when it would pass column 52. At 1.2 the median landscape spans 19 units and the walkers' valley reaches its deepest point at log t 5.2; at 2.4 it spans 38 and reaches it at 10.3, and one landscape in seven has its walkers' valley still short of the deepest point when the run stops at the cap, log t 19 (180 million steps).

const W = 64, H = 128, L = 128, NW = 3000;
const { floor, ceil, min, max, abs, sqrt, exp, log, cos, sin, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// log t a second at Speed 2, the longest run, and the hold and fade after it.
const RATE = 1, H_CAP = 19, HOLD = 1.8, FADE = 0.7;
// The ridge puts the lowest V at column X0 and draws V at K_PX columns a
// unit, so a pool rises K_PX columns for each unit of log t; a landscape
// that would run past column X0 + SPAN is drawn narrower to fit.
const X0 = 2, SPAN = 50, K_PX = 2.6;
// Base hues on the knob's wheel: ground, pools, walkers.
const HUE_GROUND = 0.46, HUE_POOL = 0.3, HUE_WALK = 0.13;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// The wheel skips orange through yellow to lime, which reads brown and olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

function normals(n) {
  const z = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    const r = sqrt(-2 * log(1 - Math.random())), a = 2 * PI * Math.random();
    z[i] = r * cos(a);
    if (i + 1 < n) z[i + 1] = r * sin(a);
  }
  return z;
}

// The environment. Site x sends a walker down the panel, to x + 1, with
// chance omega_x and up with 1 - omega_x. log rho_x = log((1 - omega_x) /
// omega_x) = sigma Z_x - mu with Z_x standard normal, so E[rho^k] =
// exp(-mu k + sigma^2 k^2 / 2), which is 1 at k = 2 mu / sigma^2: mu =
// kappa sigma^2 / 2 puts the Kesten-Kozlov-Spitzer exponent on the knob.
// V(x) = sum of log rho up to x is the potential; the walk's resting
// measure is about exp(-V), so walkers gather where V is low.
function environment(Z, sigma, kappa) {
  const mu = (kappa * sigma * sigma) / 2, n = Z.length;
  const omega = new Float64Array(n), V = new Float64Array(n);
  for (let x = 0; x < n; x++) {
    const lr = sigma * Z[x] - mu;
    omega[x] = 1 / (1 + exp(lr));
    if (x > 0) V[x] = V[x - 1] + lr;
  }
  return { omega, V };
}

// One step of the walk as an L x L matrix; the end rows hold the walker
// where a step would leave the panel.
function transition(omega) {
  const P = new Float64Array(L * L);
  for (let x = 0; x < L; x++) {
    P[x * L + min(L - 1, x + 1)] += omega[x];
    P[x * L + max(0, x - 1)] += 1 - omega[x];
  }
  return P;
}
// P squared, inside the band where P can be non-zero. Products under 1e-13
// are dropped: a row loses less than 1e-10 of its weight.
function square(P, bw) {
  const R = new Float64Array(L * L);
  for (let i = 0; i < L; i++) {
    const oi = i * L;
    for (let m = max(0, i - bw), m1 = min(L - 1, i + bw); m <= m1; m++) {
      const p = P[oi + m];
      if (p < 1e-13) continue;
      const om = m * L;
      for (let j = max(0, m - bw), j1 = min(L - 1, m + bw); j <= j1; j++) R[oi + j] += p * P[om + j];
    }
  }
  return R;
}
function cdf(P) {
  const C = new Float32Array(L * L);
  for (let i = 0, o = 0; i < L; i++) {
    let s = 0;
    for (let j = 0; j < L; j++, o++) C[o] = s += P[o];
  }
  return C;
}

// The bottoms of the valleys of depth h: b is one when, walking away from
// it either way, V climbs h above V(b), or meets a wall, before it dips
// below V(b). These are Neveu and Pitman's h-minima; between two of them V
// rises at least h above both.
function bottoms(V, h, out) {
  let n = 0;
  for (let b = 0; b < L; b++) {
    const vb = V[b];
    if ((b > 0 && V[b - 1] < vb) || (b < L - 1 && V[b + 1] < vb)) continue;
    let ok = true;
    for (let x = b - 1; x >= 0; x--) {
      if (V[x] < vb) { ok = false; break; }
      if (V[x] >= vb + h) break;
    }
    if (ok)
      for (let x = b + 1; x < L; x++) {
        if (V[x] < vb) { ok = false; break; }
        if (V[x] >= vb + h) break;
      }
    if (ok) out[n++] = b;
  }
  return n;
}
// The bottom of the valley of depth h that holds site s: Sinai's b(log t),
// where his theorem puts the walker at time t. The valley's walls are the
// highest points between its bottom and the next bottoms either side.
function valleyOf(V, h, s, buf) {
  const n = bottoms(V, h, buf);
  for (let i = 0; i < n; i++) {
    let wall = L;
    if (i < n - 1) {
      wall = buf[i];
      for (let x = buf[i]; x <= buf[i + 1]; x++) if (V[x] > V[wall]) wall = x;
    }
    if (s <= wall) return buf[i];
  }
  return buf[n - 1];
}

export function setup(params) {
  params.s = {
    hue: 0, kappa: -1, sigma: -1, Z: null, buf: new Int16Array(L), buf2: new Int16Array(L),
    pos: new Int16Array(NW), u: new Float32Array(NW),
    rgb: new Float32Array(W * H * 3), pool: new Float32Array(L), mine: new Uint8Array(L), owner: new Int16Array(L), c: [0, 0, 0],
    age: 0,
  };
  for (let j = 0; j < NW; j++) params.s.u[j] = Math.random();
}

function build(S, kappa, sigma, fresh) {
  if (fresh || !S.Z) S.Z = normals(L);
  S.kappa = kappa;
  S.sigma = sigma;
  const { omega, V } = environment(S.Z, sigma, kappa);
  S.V = V;
  let lo = 0, hi = 0;
  for (let x = 1; x < L; x++) {
    if (V[x] < V[lo]) lo = x;
    if (V[x] > V[hi]) hi = x;
  }
  S.vmin = V[lo];
  S.scale = min(K_PX, SPAN / max(1e-6, V[hi] - V[lo]));
  S.P = transition(omega);
  S.bw = 1;
  S.C = [cdf(S.P)];
  // Unbiased, the walkers start on the middle row; with a bias, near the top.
  S.s0 = round(64 - 60 * min(1, 4 * kappa));
  S.pos.fill(S.s0);
  // The depth at which the start's valley first reaches the deepest point
  // of the panel. The walkers cross later than that: an escape over a
  // barrier of height H takes e^H times a factor from the widths of the
  // valley and the barrier, and half of them are across 3.2 units of log t
  // after it in the median landscape at sigma 1.2, 1.9 at 2.4. The run
  // goes on 4.5 units, a factor of 90 in time.
  let a = 0, b = V[hi] - V[lo] + 1;
  for (let k = 0; k < 24; k++) {
    const m = (a + b) / 2;
    if (valleyOf(V, m, S.s0, S.buf) === lo) b = m;
    else a = m;
  }
  S.hEnd = min(H_CAP, max(5, b + 4.5));
  S.h = 0;
  S.t = 0;
  S.phase = 0;
  S.pt = 0;
  S.age = 0;
}

// Every walker takes 2^k steps at once, drawn from row pos of P^(2^k).
function jump(S, k) {
  const C = S.C[k], pos = S.pos;
  for (let j = 0; j < NW; j++) {
    const o = pos[j] * L, u = Math.random() * C[o + L - 1];
    let lo = 0, hi = L - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (C[o + mid] > u) hi = mid;
      else lo = mid + 1;
    }
    pos[j] = lo;
  }
}

// Bring the walkers to time floor(e^h) - 1 in jumps of powers of two,
// squaring the matrix once more when a longer jump is due.
function advance(S) {
  let rem = floor(exp(S.h) - 1) - S.t, squared = 0;
  for (let n = 0; n < 6 && rem >= 1; n++) {
    let k = floor(Math.log2(rem));
    while (k > S.C.length - 1 && S.C.length < 31 && squared < (S.bw < 32 ? 4 : 1)) {
      S.P = square(S.P, S.bw);
      S.bw = min(L, 2 * S.bw);
      S.C.push(cdf(S.P));
      squared++;
    }
    k = min(k, S.C.length - 1);
    jump(S, k);
    S.t += 2 ** k;
    rem -= 2 ** k;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 1.2], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), kappa = cl(kv[2], 0, 1), sigma = cl(kv[3], 1.2, 2.4);
  if (abs(kappa - S.kappa) > 1e-4 || abs(sigma - S.sigma) > 1e-4) build(S, kappa, sigma, false);
  const g = (d * speed) / 2;
  S.age += g;
  if (S.phase === 0) {
    S.h = min(S.hEnd, S.h + g * RATE);
    advance(S);
    if (S.h >= S.hEnd) (S.phase = 1), (S.pt = 0);
  } else {
    // Settled: the pools stop rising, and each frame every walker takes
    // the longest jump made so far, so they keep moving inside their valley.
    S.pt += g;
    jump(S, S.C.length - 1);
    if (S.phase === 1 && S.pt >= HOLD) (S.phase = 2), (S.pt = 0);
    else if (S.phase === 2 && S.pt >= FADE) build(S, kappa, sigma, true);
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.V) return;
  const V = S.V, rgb = S.rgb, pool = S.pool, mine = S.mine, buf = S.buf;
  const px = (v) => X0 + (v - S.vmin) * S.scale;
  const fade = S.phase === 2 ? 1 - S.pt / FADE : min(1, S.age / 0.5);
  rgb.fill(0);
  // The pools: each valley of depth h filled from its bottom to V(bottom)
  // + h, spreading along the rows while V stays under that level.
  mine.fill(0);
  const n = bottoms(V, S.h, buf), b0 = valleyOf(V, S.h, S.s0, S.buf2);
  // Each valley's ground takes a tint of its own from its bottom, from the
  // bottom to the top of its walls, so as log t grows the valleys merge
  // and the deeper one's tint spreads over the shallower.
  const owner = S.owner;
  for (let i = 0, from = 0; i < n; i++) {
    const b = buf[i], lv = V[b] + S.h;
    let lo = b, hi = b, wall = L - 1;
    while (lo > 0 && V[lo - 1] <= lv) lo--;
    while (hi < L - 1 && V[hi + 1] <= lv) hi++;
    for (let y = lo; y <= hi; y++) (pool[y] = lv), (mine[y] = b === b0 ? 2 : 1);
    if (i < n - 1) {
      wall = b;
      for (let x = b; x <= buf[i + 1]; x++) if (V[x] > V[wall]) wall = x;
    }
    for (let y = from; y <= wall; y++) owner[y] = b;
    from = wall + 1;
  }
  const ground = S.c;
  const ridge = hsv(wheel(HUE_GROUND + S.hue - 0.04), 0.3, 1, [0, 0, 0]);
  const water = hsv(wheel(HUE_POOL + S.hue), 0.85, 1, [0, 0, 0]);
  const walk = hsv(HUE_WALK + S.hue, 0.5, 1, [0, 0, 0]);
  const add = (x, y, col, a) => {
    if (x < 0 || x >= W || a <= 0) return;
    const o = (y * W + x) * 3;
    rgb[o] += col[0] * a;
    rgb[o + 1] += col[1] * a;
    rgb[o + 2] += col[2] * a;
  };
  for (let y = 0; y < H; y++) {
    const r = px(V[y]), ri = floor(r), fr = r - ri;
    // Ground: lit most near the ridge, fading in to a floor that still
    // reads. The valley's tint folds back at the ends of the wheel rather
    // than wrapping round, so no valley jumps from rose to lime beside its
    // neighbour.
    const b = owner[y], base = HUE_GROUND + S.hue;
    let tp = base - floor(base) + 0.24 * (((b * 0.618034) % 1) - 0.5);
    tp = tp < 0 ? -tp : tp > 0.999 ? 1.998 - tp : tp;
    hsv(wheel(tp), 0.75, b === b0 ? 1.2 : 1, ground);
    for (let x = 0; x <= ri && x < W; x++) {
      const a = (0.15 + 0.3 * exp(-(r - x - 0.5) / 6)) * (x === ri ? fr : 1);
      add(x, y, ground, a);
    }
    // The ridge, joined to the row above so the profile stays one line.
    const ra = y > 0 ? px(V[y - 1]) : r;
    for (let x = floor(min(r, ra)); x <= floor(max(r, ra)); x++) add(x, y, ridge, x === ri ? 0.85 : 0.55);
    if (mine[y]) {
      const p = min(W - 0.5, px(pool[y])), m = mine[y] === 2;
      for (let x = ri + 1; x < p; x++) add(x, y, water, m ? 0.3 : 0.17);
      add(floor(p), y, water, m ? 0.75 : 0.4);
    }
  }
  // The walkers: each one a dot in its row, at its own fixed share of the
  // way across the pool and dimmer the further out, so a crowded row glows
  // across its whole width. A walker outside every pool, still on its way
  // out of a valley Sinai's clock has already drained, gets five columns.
  for (let j = 0; j < NW; j++) {
    const y = S.pos[j], r = px(V[y]);
    const w = mine[y] ? max(2, min(W - 1, px(pool[y])) - r) : 5;
    add(floor(r + 1 + S.u[j] * w), y, walk, 0.14 - 0.07 * S.u[j]);
  }
  // Sinai's b(log t), white at the right edge; the start row, dim.
  for (let x = 60; x < W; x++) add(x, S.s0, ridge, 0.3);
  for (let x = 58; x < W; x++) add(x, b0, [1, 1, 1], 0.9);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, (255 * cl(rgb[o] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 1] * fade, 0, 1)) | 0, (255 * cl(rgb[o + 2] * fade, 0, 1)) | 0);
}
