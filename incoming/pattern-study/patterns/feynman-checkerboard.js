// ===== Patternflow pattern =====
// Title:   Feynman Checkerboard
// Family:  wave
// Idea:    Time runs down the panel and space across it on Feynman's light-cone lattice, where a particle steps one site left or right each row and every corner multiplies its amplitude by i epsilon: four such zigzag paths fall from the source with each corner marked in the colour of i^R, the exact sum over all 2^128 of them glows underneath as phase and brightness, and its gold mean position trembles from side to side, Schroedinger's Zitterbewegung.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dirac equation (Paul Dirac, 1928), Zitterbewegung (Erwin Schroedinger, 1930), Feynman's checkerboard (Richard Feynman; Richard Feynman and Albert Hibbs, Quantum Mechanics and Path Integrals, 1965, problem 2-6), continuum limit of the checkerboard (Ted Jacobson and Lawrence Schulman, 1984), pattern round 62
// Round:   62
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mass=0.08..0.4, Focus=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the source's own phase is azure, so the field opens azure at the top and turns through violet, red, gold and green as its phase runs on down the panel; a corner dot is azure, violet, red or green as the path has made 0, 1, 2 or 3 corners mod 4, and the mean is pale gold. At 0.5 the field opens amber and the mean turns lavender.
// Knob 2: Speed. How fast the present, the row the paths have reached, runs down: 16 rows a second per unit, so at 2 a sweep takes 4 s and the paths fade for 0.6 s at the bottom before four new ones leave the source; at 0.2 a sweep takes 40 s, at 3 it takes 2.7 s. Rows the present has passed are lit fully, rows ahead of it at 0.6, and the opening sweep starts on row 40.
// Knob 3: Mass. epsilon = m dt, from 0.08 to 0.4. A path turns with probability eps / (1 + eps) a step, every 13.5 rows at 0.08 and every 3.5 at 0.4; the packet's phase turns once in 2 pi / atan(eps) rows, 79 at 0.08 and 16.5 at 0.4; and the mean trembles with a period of pi / atan(eps) rows, 39 at 0.08, where it swings 3 to 6 LEDs peak to peak, and 8.3 at 0.4, where it swings 0.5 to 1.2.
// Knob 4: Focus. The source packet's width, sigma = 1.5 (1 - Focus)^1.5 / eps sites, two sites to an LED: 17 sites at the opening 0.06, 1.4 Compton wavelengths 1 / eps, where the mean trembles clearly; 6.6 sites at 0.5; at 1 a single site, the point source of Feynman's propagator, whose cone edges are the one path with no corner (right) and the one that turns at once (left), whose phase bands are the hyperbolas of constant proper time, and whose mean runs right at 0.92 c and leaves the panel on row 69.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, exp, atan2, round, ceil, hypot, PI, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The lattice: two sites to an LED across, one time step to a row down.
// The panel shows sites M .. M + 127 of a line of NX = 384 sites, and the
// line runs 192 sites either side of the source, past the 128 that light
// covers in the panel's 128 steps. Amplitude that leaves the panel's sides
// is still carried, comes back when its paths do, and never meets an end:
// the panel shows the free propagator, exactly.
const C = 2, M = 128, NX = 128 + 2 * M, X0 = M + 64;
const ux = (s) => (s - M + 0.5) / C - 0.5; // site -> splat x

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, eps: 0.08, focus: 0.06, key: '',
    Rr: new Float64Array(NX), Ri: new Float64Array(NX), Lr: new Float64Array(NX), Li: new Float64Array(NX),
    nRr: new Float64Array(NX), nRi: new Float64Array(NX), nLr: new Float64Array(NX), nLi: new Float64Array(NX),
    rho: new Float32Array(N), ph: new Float32Array(N), V: new Float32Array(N), mean: new Float64Array(H), tot: new Float64Array(H),
    D: new Float32Array(N),
    paths: [], R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), c: new Float32Array(15),
  };
}

// One step of the checkerboard, unitary form: going straight costs
// a = 1 / sqrt(1 + eps^2), a corner b = i eps / sqrt(1 + eps^2), so a path
// with R corners carries (i eps)^R / (1 + eps^2)^(T/2).
//   R(x, t+1) = a R(x-1, t) + b L(x-1, t)
//   L(x, t+1) = a L(x+1, t) + b R(x+1, t)
function field(S) {
  const eps = S.eps, a = 1 / sqrt(1 + eps * eps), b = eps / sqrt(1 + eps * eps);
  let { Rr, Ri, Lr, Li, nRr, nRi, nLr, nLi } = S;
  Rr.fill(0); Ri.fill(0); Lr.fill(0); Li.fill(0);
  // The source: a Gaussian packet at rest in the right-moving component,
  // width sigma sites, on the sites of one parity.
  const sigma = S.sigma;
  let n = 0;
  for (let s = 0; s < NX; s++) {
    const d = s - X0;
    if (d & 1) continue;
    const g = sigma < 0.5 ? +(d === 0) : exp((-d * d) / (4 * sigma * sigma));
    Rr[s] = g;
    n += g * g;
  }
  n = 1 / sqrt(n);
  for (let s = 0; s < NX; s++) Rr[s] *= n;
  const { rho, ph, mean, tot } = S;
  for (let t = 0; t < H; t++) {
    let m = 0, p = 0;
    for (let s = 0; s < NX; s++) {
      const q = Rr[s] * Rr[s] + Ri[s] * Ri[s] + Lr[s] * Lr[s] + Li[s] * Li[s];
      p += q;
      m += q * s;
    }
    mean[t] = m / p;
    tot[t] = p;
    // The brightness scale of the row: the densest site within t/2 + 2 sigma
    // of the centre, so the two straight paths along a point source's cone
    // do not black out the rest; brightness is (density / scale)^0.4.
    let mx = 0;
    const half = max(2, floor(t / 2 + 2 * S.sigma));
    for (let s = max(1, X0 - half); s <= min(NX - 2, X0 + half); s++) {
      const q = Rr[s] * Rr[s] + Ri[s] * Ri[s] + Lr[s] * Lr[s] + Li[s] * Li[s];
      if (q > mx) mx = q;
    }
    const ref = mx > 0 ? mx : 1;
    // The live site under LED X on row t is M + 2X + (t & 1).
    for (let X = 0; X < W; X++) {
      const s = M + 2 * X + ((t + X0) & 1), o = t * W + X;
      rho[o] = Rr[s] * Rr[s] + Ri[s] * Ri[s] + Lr[s] * Lr[s] + Li[s] * Li[s];
      ph[o] = atan2(Ri[s] + Li[s], Rr[s] + Lr[s]) / (2 * PI);
      S.V[o] = min(1, (rho[o] / ref) ** 0.4);
    }
    for (let s = 1; s < NX - 1; s++) {
      nRr[s] = a * Rr[s - 1] - b * Li[s - 1];
      nRi[s] = a * Ri[s - 1] + b * Lr[s - 1];
      nLr[s] = a * Lr[s + 1] - b * Ri[s + 1];
      nLi[s] = a * Li[s + 1] + b * Rr[s + 1];
    }
    nRr[0] = nRi[0] = nLr[0] = nLi[0] = 0;
    nRr[NX - 1] = nRi[NX - 1] = nLr[NX - 1] = nLi[NX - 1] = 0;
    [Rr, nRr] = [nRr, Rr];
    [Ri, nRi] = [nRi, Ri];
    [Lr, nLr] = [nLr, Lr];
    [Li, nLi] = [nLi, Li];
  }
  Object.assign(S, { Rr, Ri, Lr, Li, nRr, nRi, nLr, nLi });
}

// A path sampled with weight |amplitude| = eps^R: a corner at each step with
// probability eps / (1 + eps), starting right-moving from a site drawn from
// the packet.
function sample(S) {
  const eps = S.eps, pc = eps / (1 + eps), xs = new Int16Array(H), k = new Uint8Array(H);
  let s = X0;
  if (S.sigma >= 0.5) {
    let g;
    do g = sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * PI * Math.random()) * S.sigma;
    while (abs(g) > 3 * S.sigma);
    s = X0 + 2 * round(g / 2);
  }
  let dir = 1, R = 0;
  for (let t = 0; t < H; t++) {
    xs[t] = s;
    k[t] = R;
    if (Math.random() < pc) (dir = -dir), R++;
    s += dir;
  }
  return { xs, k };
}

// The present: a row that runs down the panel at 16 rows a second per unit
// of Speed, then waits HOLD rows' worth of time at the bottom while the
// paths fade, and starts again from the source with new paths.
const HOLD = 20, NP = 4;

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.08, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.eps = cl(kv[2], 0.08, 0.4);
  S.focus = cl(kv[3], 0, 1);
  S.sigma = (1.5 * (1 - S.focus) ** 1.5) / S.eps;
  const key = S.eps.toFixed(4) + '/' + S.sigma.toFixed(3);
  if (key !== S.key) {
    S.key = key;
    field(S);
    S.paths = [];
  }
  if (!S.paths.length) {
    for (let i = 0; i < NP; i++) S.paths.push(sample(S));
    if (S.front === undefined) S.front = 40;
  }
  S.front += d * 16 * S.speed;
  if (S.front > H + HOLD) {
    S.front = 0;
    for (let i = 0; i < NP; i++) S.paths[i] = sample(S);
  }
}

function splat(S, x, y, v, c, o) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  add(S, ix, iy, (1 - fx) * (1 - fy) * v, c, o);
  add(S, ix + 1, iy, fx * (1 - fy) * v, c, o);
  add(S, ix, iy + 1, (1 - fx) * fy * v, c, o);
  add(S, ix + 1, iy + 1, fx * fy * v, c, o);
}
function add(S, x, y, v, c, o) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const p = y * W + x;
  S.R[p] += v * c[o];
  S.G[p] += v * c[o + 1];
  S.B[p] += v * c[o + 2];
}
function line(S, x0, y0, x1, y1, v, c, o) {
  const L = hypot(x1 - x0, y1 - y0), n = max(1, ceil(L * 3)), w = (v * L) / n;
  for (let i = 1; i <= n; i++) splat(S, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, w, c, o);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, c, V, ph, mean, D } = S;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  D.fill(1);
  const tmp = [0, 0, 0], now = S.front, head = min(H - 1, now), fade = now > H ? max(0, 1 - (now - H) / HOLD) : 1;
  // Shade under the lines first, so they read over the field.
  const shade = (x, y, k) => {
    const ix = round(x), iy = round(y);
    if (iy < 0 || iy >= H) return;
    for (let X = ix - 1; X <= ix + 1; X++) if (X >= 0 && X < W) D[iy * W + X] = min(D[iy * W + X], k);
  };
  for (let t = 0; t <= min(H - 1, now); t++) shade(ux(mean[t]), t, 0.35);
  if (fade > 0) for (const P of S.paths) for (let t = 0; t <= head; t++) shade(ux(P.xs[t]), t, 1 - 0.65 * fade);
  // The field: phase as hue, the amplitude as brightness, full in the rows
  // the present has passed and brightest just behind it, faint ahead of it.
  for (let t = 0; t < H; t++) {
    const u = cl((now - t) / 8 + 0.5, 0, 1), lit = 0.34 + 0.2 * u * u * (3 - 2 * u) + (t <= now ? 0.14 * exp(-(now - t) / 10) : 0);
    for (let X = 0; X < W; X++) {
      const o = t * W + X;
      hsv(S.hue + 0.55 + ph[o], 0.85, V[o] * lit * D[o], tmp, 0);
      R[o] = tmp[0];
      G[o] = tmp[1];
      B[o] = tmp[2];
    }
  }
  c[0] = c[1] = c[2] = 0.3; // cone
  c[3] = c[4] = c[5] = 1; // white
  hsv(S.hue + 0.14, 0.55, 1, c, 9); // the mean
  // The light cone of the packet's centre.
  for (let t = 0; t < H; t += 2) {
    splat(S, ux(X0 + t), t, 1, c, 0);
    splat(S, ux(X0 - t), t, 1, c, 0);
  }
  // The paths, down to the present.
  if (fade > 0)
    for (const P of S.paths) {
      for (let t = 0; t + 1 <= head; t++) {
        const v = 0.3 + 0.65 * exp(-(head - t) / 24);
        line(S, ux(P.xs[t]), t, ux(P.xs[t + 1]), t + 1, v * fade, c, 3);
      }
      for (let t = 1; t + 1 <= head; t++)
        if (P.k[t + 1] !== P.k[t]) {
          hsv(S.hue + 0.55 + P.k[t + 1] / 4, 1, 1, c, 6);
          splat(S, ux(P.xs[t]), t, 2 * fade, c, 6);
        }
      const t0 = floor(head), f = head - t0;
      if (t0 < H - 1) splat(S, ux(P.xs[t0] + (P.xs[t0 + 1] - P.xs[t0]) * f), head, 1.5 * fade, c, 3);
    }
  // The mean position, row by row: drawn through the past, dotted ahead.
  for (let t = 0; t < H; t++) if (t <= now || t % 3 === 0) splat(S, ux(mean[t]), t, t <= now ? 1.2 : 0.6, c, 9);
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p++)
      display.setPixel(x, y, round(min(1, R[p]) * 255), round(min(1, G[p]) * 255), round(min(1, B[p]) * 255));
}
