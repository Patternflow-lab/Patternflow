// ===== Patternflow pattern =====
// Title:   Hill's Regions
// Family:  particle
// Idea:    Seven test particles in the rotating frame of two masses, stood upright so the masses sit one above the other, are fenced in by the zero-velocity curve of their Jacobi constant, and lowering the constant opens the necks at the Lagrange points L1, L2 and L3 one by one, so the particles leak from one mass to the other and out past the small one.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: collinear and triangular Lagrange points (Leonhard Euler, 1767; Joseph-Louis Lagrange, 1772), Jacobi integral of the circular restricted three-body problem (Carl Jacobi, 1836), zero-velocity curves and Hill's regions (George William Hill, 1878), pattern round 64
// Round:   64
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Jacobi=0..4, Mass=0.1..0.5, Trail=2..10
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the forbidden region is dark violet with the curves of lower C drawn in it as a contour map, its edge pale cyan, the trails run from amber through lime to teal, the large mass is pale gold and the small one sky blue. The dark wall skips orange and yellow, which read brown on the panel.
// Knob 2: Jacobi. The Jacobi constant C = 2 Omega - v^2 as a ladder whose whole numbers count the open necks: at 0 C is above C1 and each mass keeps its own particles, the neck at L1 between the masses opens at 0.5, the one at L2 beyond the small mass at 1.5, the one at L3 beyond the large mass at 2.5, and at 4 C = 3 - mu + mu^2 and the last walls round L4 and L5 shrink to points. At mu = 0.1 that is C = 3.715 at 0, C1 = 3.597 at 0.5, C2 = 3.467 at 1.5, 3.283 at the opening 2, C3 = 3.100 at 2.5 and 2.910 at 4. The four-dot mark on a Lagrange point brightens when its neck is open, and a particle a moving wall lands on starts again.
// Knob 3: Mass. The small mass's share mu, from 0.1 to 0.5. At 0.1 the small mass sits on row 23, L1 13 rows below it and L2 16 rows above; at 0.5 the masses are equal, the picture is symmetric about the middle row, and L2 and L3 open together.
// Knob 4: Trail. Seconds of path each particle leaves behind, 2 to 10. Time runs at 0.9 units a second, so the frame turns once every 7 seconds and a particle close to the large mass circles it in about one.

const W = 64, H = 128, N = W * H;
const { floor, min, max, sqrt, abs, round, exp, hypot, PI, cos, sin } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The rotating frame: the primary, mass 1 - mu, at (-mu, 0) and the
// secondary, mass mu, at (1 - mu, 0), turning once in 2 pi. The x axis runs
// up the panel, S LEDs to a unit, with x = XC on the middle row.
const S = 46, XC = 0.02;
const toRow = (x) => 63.5 - (x - XC) * S;
const toCol = (y) => 31.5 + y * S;

// Twice the effective potential, 2 Omega = x^2 + y^2 + 2(1 - mu)/r1 + 2 mu/r2.
// The Jacobi constant is C = 2 Omega - v^2, so v^2 = 2 Omega - C and the
// particle can never be where 2 Omega < C.
function omega2(mu, x, y) {
  const r1 = hypot(x + mu, y), r2 = hypot(x - 1 + mu, y);
  return x * x + y * y + (2 * (1 - mu)) / r1 + (2 * mu) / r2;
}
// d Omega / dx on the axis, whose three roots are L3 < L1 < L2.
function omx(mu, x) {
  const a = x + mu, b = x - 1 + mu;
  return x - ((1 - mu) * a) / abs(a * a * a) - (mu * b) / abs(b * b * b);
}
function root(mu, lo, hi) {
  let flo = omx(mu, lo);
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2, fm = omx(mu, m);
    if (fm * flo > 0) (lo = m), (flo = fm);
    else hi = m;
  }
  return (lo + hi) / 2;
}

function lagrange(st) {
  const mu = st.mu, e = 1e-9;
  const L1 = root(mu, -mu + e, 1 - mu - e);
  const L2 = root(mu, 1 - mu + e, 3);
  const L3 = root(mu, -3, -mu - e);
  st.L = [
    [L1, 0],
    [L2, 0],
    [L3, 0],
    [0.5 - mu, sqrt(3) / 2],
    [0.5 - mu, -sqrt(3) / 2],
  ];
  st.CL = [omega2(mu, L1, 0), omega2(mu, L2, 0), omega2(mu, L3, 0), 3 - mu + mu * mu];
}

// The Jacobi knob as a ladder: at 0.5 the L1 neck is about to open, at 1.5
// L2, at 2.5 L3, and at 4 the last forbidden islands round L4 and L5 shrink
// to points. So the knob's whole number is how many necks are open.
function jacobiOf(st, k) {
  const [c1, c2, c3, c4] = st.CL;
  const nodes = [
    [0, c1 + 0.6 * (c1 - c2) + 0.04],
    [0.5, c1],
    [1.5, c2],
    [2.5, c3],
    [4, c4],
  ];
  for (let i = 1; i < nodes.length; i++)
    if (k <= nodes[i][0]) {
      const [k0, a] = nodes[i - 1], [k1, b] = nodes[i];
      return a + ((b - a) * (k - k0)) / (k1 - k0);
    }
  return c4;
}

// The field of 2 Omega and its gradient over the panel, built when mu changes.
function buildField(st) {
  const mu = st.mu;
  for (let r = 0; r < H; r++) {
    const x = XC + (63.5 - r) / S;
    for (let c = 0; c < W; c++) {
      const y = (c - 31.5) / S, o = r * W + c;
      const ax = x + mu, bx = x - 1 + mu;
      const r1 = hypot(ax, y), r2 = hypot(bx, y);
      const k1 = (1 - mu) / (r1 * r1 * r1), k2 = mu / (r2 * r2 * r2);
      st.F[o] = x * x + y * y + (2 * (1 - mu)) / r1 + (2 * mu) / r2;
      const gx = 2 * (x - k1 * ax - k2 * bx), gy = 2 * (y - k1 * y - k2 * y);
      st.G[o] = max(1e-6, hypot(gx, gy));
    }
  }
}

// Equations of motion in the rotating frame:
//   x'' = 2 y' + dOmega/dx,  y'' = -2 x' + dOmega/dy.
function deriv(mu, s, out) {
  const [x, y, vx, vy] = s;
  const ax = x + mu, bx = x - 1 + mu;
  const r1 = hypot(ax, y), r2 = hypot(bx, y);
  const k1 = (1 - mu) / (r1 * r1 * r1), k2 = mu / (r2 * r2 * r2);
  out[0] = vx;
  out[1] = vy;
  out[2] = 2 * vy + x - k1 * ax - k2 * bx;
  out[3] = -2 * vx + y - k1 * y - k2 * y;
}

const K = [new Float64Array(4), new Float64Array(4), new Float64Array(4), new Float64Array(4)], T = new Float64Array(4);
function rk4(mu, s, h) {
  deriv(mu, s, K[0]);
  for (let i = 0; i < 4; i++) T[i] = s[i] + 0.5 * h * K[0][i];
  deriv(mu, T, K[1]);
  for (let i = 0; i < 4; i++) T[i] = s[i] + 0.5 * h * K[1][i];
  deriv(mu, T, K[2]);
  for (let i = 0; i < 4; i++) T[i] = s[i] + h * K[2][i];
  deriv(mu, T, K[3]);
  for (let i = 0; i < 4; i++) s[i] += (h / 6) * (K[0][i] + 2 * K[1][i] + 2 * K[2][i] + K[3][i]);
}

// Body radii in frame units, the drawn disc and the collision.
const bodyR = (m) => 0.035 + 0.06 * Math.cbrt(m);

// The LEDs a particle can reach from the masses without crossing a wall,
// found by a flood fill over the allowed region whenever C or mu moves.
function reach(st) {
  const key = st.mu + "/" + st.C;
  if (st.maskKey === key) return;
  st.maskKey = key;
  const M = st.mask, Q = st.queue, F = st.F, C = st.C;
  M.fill(0);
  let n = 0, qh = 0;
  for (const x of [-st.mu, 1 - st.mu]) {
    const o = round(toRow(x)) * W + 32;
    if (o >= 0 && o < N && !M[o]) (M[o] = 1), (Q[n++] = o);
  }
  while (qh < n) {
    const o = Q[qh++], c = o % W;
    for (const q of [o - W, o + W, c > 0 ? o - 1 : -1, c < W - 1 ? o + 1 : -1])
      if (q >= 0 && q < N && !M[q] && F[q] > C + 0.02) (M[q] = 1), (Q[n++] = q);
  }
  st.reachable = n;
}

// A particle starts anywhere the masses can reach, with the speed its
// Jacobi constant gives it there, in a random direction. Half of them start
// in the lobe of the smaller mass, so there is always something to leak.
function spawn(st, p) {
  const mu = st.mu, C = st.C;
  reach(st);
  const L1 = st.L[0][0];
  for (let tries = 0; tries < 80; tries++) {
    let x, y;
    if (Math.random() < 0.45) {
      const r = bodyR(mu) + 0.01 + Math.random() * 0.8 * (1 - mu - L1), a = Math.random() * 2 * PI;
      x = 1 - mu + r * cos(a);
      y = r * sin(a);
    } else {
      const o = st.queue[floor(Math.random() * st.reachable)];
      x = XC + (63.5 - floor(o / W) - Math.random() + 0.5) / S;
      y = ((o % W) - 31.5 + Math.random() - 0.5) / S;
    }
    if (hypot(x + mu, y) < bodyR(1 - mu) + 0.03 || hypot(x - 1 + mu, y) < bodyR(mu) + 0.01) continue;
    const v2 = omega2(mu, x, y) - C;
    if (v2 <= 0.01) continue;
    const v = sqrt(v2), b = Math.random() * 2 * PI;
    p.s[0] = x;
    p.s[1] = y;
    p.s[2] = v * cos(b);
    p.s[3] = v * sin(b);
    break;
  }
  p.n = 0;
  p.age = 0;
  p.out = 0;
}

// Put the speed back on the shell of the Jacobi constant, so the particle
// keeps to the region the panel draws for it even as the knob moves.
function shell(st, p) {
  const s = p.s, v2 = omega2(st.mu, s[0], s[1]) - st.C, v = hypot(s[2], s[3]);
  if (v2 <= 0) {
    s[2] = s[3] = 0;
    return v2 < -0.05;
  }
  if (v > 1e-9) {
    const f = sqrt(v2) / v;
    s[2] *= f;
    s[3] *= f;
  }
  return false;
}

const NP = 7, HIST = 320;

export function setup(params) {
  params.st = {
    mu: -1, C: 0, k: [0, 2, 0.1, 2],
    F: new Float32Array(N), G: new Float32Array(N), mask: new Uint8Array(N), queue: new Int32Array(N), maskKey: '', reachable: 0,
    R: new Float32Array(N), Gc: new Float32Array(N), B: new Float32Array(N),
    parts: [], t: 0, frame: 0, c: new Float32Array(3),
  };
}

function step(st, p, T) {
  const mu = st.mu, s = p.s;
  let left = T;
  while (left > 0) {
    const r1 = hypot(s[0] + mu, s[1]), r2 = hypot(s[0] - 1 + mu, s[1]);
    // Small steps near a mass: a Kepler orbit there gets 300 steps a turn.
    const h = min(left, 0.004, 0.02 * min(r1 ** 1.5, (r2 ** 1.5) / sqrt(mu / 0.1)));
    rk4(mu, s, h);
    left -= h;
    if (r1 < bodyR(1 - mu) * 0.8 || r2 < bodyR(mu) * 0.8) return true;
  }
  return shell(st, p);
}

export function update(dt, input, params) {
  if (!params.st) setup(params);
  const st = params.st, kv = input.knobValues || [0, 2, 0.1, 2], d = cl(dt || 0, 0, 0.1);
  st.k = [kv[0], cl(kv[1], 0, 4), cl(kv[2], 0.1, 0.5), cl(kv[3], 2, 10)];
  const mu = st.k[2];
  if (abs(mu - st.mu) > 1e-6) {
    st.mu = mu;
    lagrange(st);
    buildField(st);
  }
  st.C = jacobiOf(st, st.k[1]);
  if (!st.parts.length) {
    for (let i = 0; i < NP; i++) {
      const p = { s: new Float64Array(4), hx: new Float32Array(HIST), hy: new Float32Array(HIST), n: 0, head: 0, age: 0, out: 0, hue: i / NP };
      spawn(st, p);
      st.parts.push(p);
    }
    // Run the opening for ten seconds so the longest trails are there at once.
    for (let f = 0; f < 300; f++) advance(st, 1 / 30);
  }
  advance(st, d);
}

const SPEED = 0.9;

function advance(st, d) {
  st.t += d;
  for (const p of st.parts) {
    p.age += d;
    // A particle sitting in a wall the knob just moved over starts again.
    let dead = shell(st, p);
    if (!dead) dead = step(st, p, d * SPEED);
    const row = toRow(p.s[0]), col = toCol(p.s[1]);
    if (row < -12 || row > H + 12 || col < -12 || col > W + 12) p.out += d;
    else p.out = 0;
    if (dead || p.out > 0.6) {
      spawn(st, p);
      continue;
    }
    p.head = (p.head + 1) % HIST;
    p.hx[p.head] = col;
    p.hy[p.head] = row;
    p.n = min(HIST, p.n + 1);
  }
}

function splat(st, x, y, v, c) {
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  add(st, ix, iy, (1 - fx) * (1 - fy) * v, c);
  add(st, ix + 1, iy, fx * (1 - fy) * v, c);
  add(st, ix, iy + 1, (1 - fx) * fy * v, c);
  add(st, ix + 1, iy + 1, fx * fy * v, c);
}
function add(st, x, y, v, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = y * W + x;
  st.R[o] += v * c[0];
  st.Gc[o] += v * c[1];
  st.B[o] += v * c[2];
}

export function draw(display, params) {
  const st = params.st;
  if (!st || st.mu < 0) return;
  const { F, G, R, Gc, B, c } = st, C = st.C, hue = st.k[0];
  const wall = [0, 0, 0], edge = [0, 0, 0], topo = [0, 0, 0], glow = [0, 0, 0];
  // The wall's dark hue skips orange and yellow, which read brown and olive.
  const wh = 0.2 + 0.8 * frac(hue + 0.7);
  hsv(wh, 0.75, 0.2, wall, 0);
  hsv(wh, 0.55, 0.36, topo, 0);
  hsv(hue + 0.52, 0.45, 1, edge, 0);
  hsv(wh - 0.1, 0.6, 0.07, glow, 0);
  const DL = 0.06;
  for (let o = 0; o < N; o++) {
    const f = F[o], g = G[o] / S;
    // Distance in LEDs to the zero-velocity curve 2 Omega = C.
    const dist = (f - C) / g;
    let r = 0, gg = 0, b = 0;
    if (dist < 0) {
      // The forbidden region, with the curves of lower C it would retreat
      // to drawn in it as a contour map.
      const q = f / DL, dl = abs(q - round(q)) * DL / g;
      const line = cl(1 - dl / 0.7, 0, 1);
      r = wall[0] + (topo[0] - wall[0]) * line;
      gg = wall[1] + (topo[1] - wall[1]) * line;
      b = wall[2] + (topo[2] - wall[2]) * line;
    } else {
      // The allowed region, faintly lit by the speed a particle has there.
      const v = cl((f - C) * 0.8, 0, 1);
      r = glow[0] * v;
      gg = glow[1] * v;
      b = glow[2] * v;
    }
    const e = cl(1.15 - abs(dist) / 0.9, 0, 1);
    R[o] = r + (edge[0] - r) * e;
    Gc[o] = gg + (edge[1] - gg) * e;
    B[o] = b + (edge[2] - b) * e;
  }
  // Lagrange points: bright when their neck is open, dim when shut.
  for (let i = 0; i < 5; i++) {
    const [x, y] = st.L[i];
    const open = i < 3 ? C < st.CL[i] : C < st.CL[3] + 1e-9;
    const v = open ? 0.9 : 0.35;
    c[0] = c[1] = c[2] = v;
    const rr = toRow(x), cc = toCol(y);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) splat(st, cc + dx, rr + dy, 0.8, c);
  }
  // The trails, oldest faintest.
  const tr = st.k[3] * 30;
  for (const p of st.parts) {
    hsv(hue + 0.08 + p.hue * 0.5, 0.6, 1, c, 0);
    const m = min(p.n, floor(tr), HIST);
    const fadeIn = cl(p.age / 0.4, 0, 1);
    for (let j = 1; j < m; j++) {
      const a = (p.head - j + 1 + HIST) % HIST, b = (p.head - j + HIST) % HIST;
      const x0 = p.hx[a], y0 = p.hy[a], x1 = p.hx[b], y1 = p.hy[b];
      const w = 1.5 * (1 - j / m) ** 1.2 * fadeIn;
      const L = hypot(x1 - x0, y1 - y0), n = max(1, Math.ceil(L * 2));
      if (L > 30) continue;
      for (let i = 0; i < n; i++) splat(st, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, (w * 0.9 * L) / n, c);
    }
    c[0] = c[0] * 0.3 + 0.7;
    c[1] = c[1] * 0.3 + 0.7;
    c[2] = c[2] * 0.3 + 0.7;
    if (p.n) splat(st, p.hx[p.head], p.hy[p.head], 2 * fadeIn, c);
  }
  // The two masses.
  const mu = st.mu;
  for (const [mx, m, h] of [
    [-mu, 1 - mu, 0.13],
    [1 - mu, mu, 0.55],
  ]) {
    const rr = toRow(mx), cc = toCol(0), rad = bodyR(m) * S;
    hsv(hue + h, 0.35, 1, c, 0);
    for (let y = floor(rr - rad - 1); y <= rr + rad + 1; y++)
      for (let x = floor(cc - rad - 1); x <= cc + rad + 1; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const dd = hypot(x - cc, y - rr), a = cl(rad + 0.5 - dd, 0, 1);
        const o = y * W + x;
        R[o] += (c[0] - R[o]) * a;
        Gc[o] += (c[1] - Gc[o]) * a;
        B[o] += (c[2] - B[o]) * a;
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++)
      display.setPixel(x, y, round(min(1, R[o]) * 255), round(min(1, Gc[o]) * 255), round(min(1, B[o]) * 255));
}
