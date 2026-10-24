// ===== Patternflow pattern =====
// Title:   Thomson Problem
// Family:  physics
// Idea:    Equal point charges on a slowly turning sphere push each other into an almost triangular lattice, and the charges with five neighbours instead of six, which Euler's formula keeps at exactly twelve more than those with seven, glow gold among the pale-centred blue ones.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Thomson problem (J. J. Thomson, 1904), with the scars of Bowick, Nelson and Travesset (2000), pattern round 34
// Round:   34
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Charges=100..480, Heat=0..1
//
// Knob 1: Hue. Turns the sphere once round the wheel. At 0 the sixfold charges are sky blue with pale centres, the fivefold gold and the sevenfold magenta; at 0.25 they are violet, green and orange, at 0.5 orange, blue and green, at 0.75 green, magenta and blue.
// Knob 2: Speed. How fast the sphere turns and the charges move. At 2 the sphere turns 0.2 radians a second, once in 31 seconds, and the charges take 60 descent steps a second, so a scattered sphere is a lattice again within half a second; at 0.2 a turn takes over five minutes and the lattice five seconds; at 3 a turn takes 21 seconds.
// Knob 3: Charges. 100 to 480 charges. At 100, 11 LEDs apart, the opening holds exactly twelve fivefold charges and no sevenfold one, 0.02 above the known minimum energy 4448.351; at 200 two 5-7 pairs are left over, at 300 four; at 480, 5 LEDs apart, the twelve have grown into short scars, gold-magenta-gold chains, 25 fivefold and 13 sevenfold charges in all. Turning it drops new charges at random places or takes the last ones away, and the lattice heals round them.
// Knob 4: Heat. A random kick at each step, up to 0.075 of the lattice spacing at 1. At 0.06 the lattice holds still; at 0.5 one to three 5-7 pairs flicker in and out every few seconds; at 1 four to twelve pairs come and go at once, with a fourfold charge now and then, and the fivefold charges wander.
// Buttons: K1 tap scatters every charge at random over the sphere, and they anneal back into a lattice in front of you.

const W = 64, H = 128, CX = 31.5, CY = 63.5, RS = 29;
const NMIN = 100, NMAX = 480;
// Sixfold, fivefold and sevenfold charges: hue offset, saturation at the
// rim and at the centre, and peak level.
const TYPES = [
  [0, 1, 0.4, 215],
  [0.58, 1, 0.45, 250],
  [0.3, 1, 0.4, 240],
];
// The glow's sigma in LEDs, or a fifth of the lattice spacing where that is less.
const SIG = 2.15;
const { floor, min, max, abs, sqrt, sin, cos, exp, log, round, random, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Lattice spacing on the unit sphere: each charge holds (sqrt3/2) a^2 of the
// 4 pi of surface.
const spacing = (n) => sqrt((8 * PI) / (sqrt(3) * n));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

function gauss() {
  const u = 1 - random(), v = random();
  return sqrt(-2 * log(u)) * cos(2 * PI * v);
}

function scatter(X, from, to) {
  for (let i = from; i < to; i++) {
    const z = 2 * random() - 1, f = 2 * PI * random(), r = sqrt(1 - z * z);
    X[3 * i] = r * cos(f);
    X[3 * i + 1] = r * sin(f);
    X[3 * i + 2] = z;
  }
}

// One step of projected gradient descent on E = sum 1/r_ij, with momentum
// beta. The step is 0.15 a^3; plain descent at 0.25 a^3 rang and never
// settled. No charge moves more than a fifth of the spacing in one step, so a
// fresh scatter, where two charges can sit almost on top of each other, stays
// calm. Heat adds a random kick of up to 0.075 a per step.
function relax(S, kick, beta) {
  const { X, F, M } = S, n = S.n;
  F.fill(0, 0, 3 * n);
  for (let i = 0; i < n; i++) {
    const xi = X[3 * i], yi = X[3 * i + 1], zi = X[3 * i + 2];
    let fx = 0, fy = 0, fz = 0;
    for (let j = i + 1; j < n; j++) {
      const dx = xi - X[3 * j], dy = yi - X[3 * j + 1], dz = zi - X[3 * j + 2];
      const r2 = dx * dx + dy * dy + dz * dz + 1e-9, q = 1 / (r2 * sqrt(r2));
      fx += dx * q;
      fy += dy * q;
      fz += dz * q;
      F[3 * j] -= dx * q;
      F[3 * j + 1] -= dy * q;
      F[3 * j + 2] -= dz * q;
    }
    F[3 * i] += fx;
    F[3 * i + 1] += fy;
    F[3 * i + 2] += fz;
  }
  const a = spacing(n), eta = 0.15 * a * a * a, cap = 0.2 * a, k = kick * a;
  for (let i = 0; i < n; i++) {
    const o = 3 * i, x = X[o], y = X[o + 1], z = X[o + 2];
    let fx = F[o], fy = F[o + 1], fz = F[o + 2];
    const d = fx * x + fy * y + fz * z;
    fx = beta * M[o] + eta * (fx - d * x);
    fy = beta * M[o + 1] + eta * (fy - d * y);
    fz = beta * M[o + 2] + eta * (fz - d * z);
    const e = fx * x + fy * y + fz * z;
    fx -= e * x;
    fy -= e * y;
    fz -= e * z;
    const m = sqrt(fx * fx + fy * fy + fz * fz);
    if (m > cap) {
      fx *= cap / m;
      fy *= cap / m;
      fz *= cap / m;
    }
    M[o] = fx;
    M[o + 1] = fy;
    M[o + 2] = fz;
    if (k > 0) {
      fx += k * gauss();
      fy += k * gauss();
      fz += k * gauss();
    }
    const nx = x + fx, ny = y + fy, nz = z + fz, l = 1 / sqrt(nx * nx + ny * ny + nz * nz);
    X[o] = nx * l;
    X[o + 1] = ny * l;
    X[o + 2] = nz * l;
  }
}

function energy(X, n) {
  let e = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const dx = X[3 * i] - X[3 * j], dy = X[3 * i + 1] - X[3 * j + 1], dz = X[3 * i + 2] - X[3 * j + 2];
      e += 1 / sqrt(dx * dx + dy * dy + dz * dz);
    }
  return e;
}

// The Delaunay triangulation of points on a sphere is their convex hull.
// Incremental hull: each new point removes the faces it sees and joins the
// horizon around them to itself. E maps a directed edge u->v to its face.
function hull(S) {
  const P = S.U, n = S.n, { fa, fb, fc, fx, fy, fz, fd, vis, E } = S;
  let nf = 0;
  const add = (a, b, c) => {
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
    const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az;
    const vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    fa[nf] = a;
    fb[nf] = b;
    fc[nf] = c;
    fx[nf] = x;
    fy[nf] = y;
    fz[nf] = z;
    fd[nf] = x * ax + y * ay + z * az;
    vis[nf] = 0;
    E[a * n + b] = nf;
    E[b * n + c] = nf;
    E[c * n + a] = nf;
    return nf++;
  };
  // The fourth point of the first tetrahedron is the one farthest from the
  // plane of the first three.
  let k = 3, best = -1;
  for (let j = 3; j < n; j++) {
    const v = abs(orient(P, 0, 1, 2, j));
    if (v > best) (best = v), (k = j);
  }
  let live = [];
  if (orient(P, 0, 1, 2, k) < 0) live.push(add(0, 1, 2), add(1, 0, k), add(2, 1, k), add(0, 2, k));
  else live.push(add(0, 2, 1), add(0, 1, k), add(1, 2, k), add(2, 0, k));
  const seen = [], rim = [];
  for (let p = 3; p < n; p++) {
    if (p === k) continue;
    const px = P[3 * p], py = P[3 * p + 1], pz = P[3 * p + 2];
    seen.length = 0;
    for (let q = 0; q < live.length; q++) {
      const f = live[q];
      if (fx[f] * px + fy[f] * py + fz[f] * pz - fd[f] > 1e-13) {
        vis[f] = 1;
        seen.push(f);
      }
    }
    if (!seen.length) continue;
    rim.length = 0;
    for (const f of seen) {
      const a = fa[f], b = fb[f], c = fc[f];
      if (!vis[E[b * n + a]]) rim.push(a, b);
      if (!vis[E[c * n + b]]) rim.push(b, c);
      if (!vis[E[a * n + c]]) rim.push(c, a);
    }
    const next = [];
    for (const f of live) if (!vis[f]) next.push(f);
    for (let r = 0; r < rim.length; r += 2) next.push(add(rim[r], rim[r + 1], p));
    live = next;
  }
  // Keep the faces as the triangulation the flips look after from here on.
  S.nt = live.length;
  for (let t = 0; t < live.length; t++) {
    const f = live[t];
    S.ta[t] = fa[f];
    S.tb[t] = fb[f];
    S.tc[t] = fc[f];
  }
  for (let t = 0; t < S.nt; t++) {
    const a = S.ta[t], b = S.tb[t], c = S.tc[t];
    E[a * n + b] = t;
    E[b * n + c] = t;
    E[c * n + a] = t;
  }
}

// (d - a) . ((b - a) x (c - a)): positive when d lies outside the plane of the
// triangle abc, which on the sphere means inside its circumcircle.
function orient(P, a, b, c, d) {
  const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2];
  const ux = P[3 * b] - ax, uy = P[3 * b + 1] - ay, uz = P[3 * b + 2] - az;
  const vx = P[3 * c] - ax, vy = P[3 * c + 1] - ay, vz = P[3 * c + 2] - az;
  const wx = P[3 * d] - ax, wy = P[3 * d + 1] - ay, wz = P[3 * d + 2] - az;
  return wx * (uy * vz - uz * vy) + wy * (uz * vx - ux * vz) + wz * (ux * vy - uy * vx);
}

// Between hulls the triangulation follows the charges by edge flips. An edge
// flips only once the far point is inside the circumcircle by 2% of what a
// perfect lattice holds it outside, so a nearly square quad does not toggle
// a 5-7 pair from frame to frame. A face turned inside out asks for a new hull.
function maintain(S) {
  const P = S.U, n = S.n, { ta, tb, tc, E } = S;
  for (let t = 0; t < S.nt; t++) {
    const a = ta[t], b = tb[t], c = tc[t];
    const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2];
    const vx = P[3 * c] - P[3 * a], vy = P[3 * c + 1] - P[3 * a + 1], vz = P[3 * c + 2] - P[3 * a + 2];
    const d = (uy * vz - uz * vy) * P[3 * a] + (uz * vx - ux * vz) * P[3 * a + 1] + (ux * vy - uy * vx) * P[3 * a + 2];
    if (d <= 0) return hull(S);
  }
  const a = spacing(n), thr = 0.02 * 0.433 * a * a * a * a;
  for (let pass = 0; pass < 8; pass++) {
    let flips = 0;
    for (let t = 0; t < S.nt; t++)
      for (let e = 0; e < 3; e++) {
        const u = e === 0 ? ta[t] : e === 1 ? tb[t] : tc[t];
        const v = e === 0 ? tb[t] : e === 1 ? tc[t] : ta[t];
        const w = e === 0 ? tc[t] : e === 1 ? ta[t] : tb[t];
        if (u > v) continue;
        const s = E[v * n + u];
        const x = ta[s] !== u && ta[s] !== v ? ta[s] : tb[s] !== u && tb[s] !== v ? tb[s] : tc[s];
        if (orient(P, u, v, w, x) > thr) {
          ta[t] = w;
          tb[t] = u;
          tc[t] = x;
          ta[s] = x;
          tb[s] = v;
          tc[s] = w;
          E[w * n + u] = t;
          E[u * n + x] = t;
          E[x * n + w] = t;
          E[x * n + v] = s;
          E[v * n + w] = s;
          E[w * n + x] = s;
          flips++;
          break;
        }
      }
    if (!flips) break;
  }
}

// U is the display position: the charge's position smoothed over about seven
// steps and put back on the sphere, so heat shows as a wobble and not a buzz,
// and the lattice is read from where the charges sit, not where they shiver.
function smooth(S, k) {
  const { X, V, U } = S;
  for (let i = 0; i < S.n; i++) {
    const o = 3 * i;
    V[o] += k * (X[o] - V[o]);
    V[o + 1] += k * (X[o + 1] - V[o + 1]);
    V[o + 2] += k * (X[o + 2] - V[o + 2]);
    const l = 1 / sqrt(V[o] * V[o] + V[o + 1] * V[o + 1] + V[o + 2] * V[o + 2]);
    U[o] = V[o] * l;
    U[o + 1] = V[o + 1] * l;
    U[o + 2] = V[o + 2] * l;
  }
}

function degrees(S) {
  const { deg, ta, tb, tc } = S;
  deg.fill(0, 0, S.n);
  for (let t = 0; t < S.nt; t++) {
    deg[ta[t]]++;
    deg[tb[t]]++;
    deg[tc[t]]++;
  }
}

// The opening: a few scatters, each run down 400 steps with heavy momentum
// (0.9), and the one with the lowest energy kept. At 100 charges the best of
// five opens 0.02 above the known minimum 4448.3506, with just the twelve.
function settle(S) {
  const n = S.n, tries = n <= 160 ? 5 : n <= 300 ? 3 : 1, steps = n <= 300 ? 400 : 300;
  const keep = new Float64Array(3 * n);
  let best = Infinity;
  for (let r = 0; r < tries; r++) {
    scatter(S.X, 0, n);
    S.M.fill(0);
    for (let i = 0; i < steps; i++) relax(S, 0, 0.9);
    const e = energy(S.X, n);
    if (e < best) {
      best = e;
      keep.set(S.X.subarray(0, 3 * n));
    }
  }
  S.X.set(keep);
  S.V.set(keep);
  S.U.set(keep);
  S.M.fill(0);
  hull(S);
  degrees(S);
  for (let i = 0; i < n; i++) {
    S.f5[i] = S.deg[i] < 6 ? 1 : 0;
    S.f7[i] = S.deg[i] > 6 ? 1 : 0;
  }
}

function resize(S, n) {
  const old = S.n;
  S.n = n;
  if (n > old) {
    scatter(S.X, old, n);
    for (let i = 3 * old; i < 3 * n; i++) {
      S.V[i] = S.U[i] = S.X[i];
      S.M[i] = 0;
    }
    for (let i = old; i < n; i++) S.f5[i] = S.f7[i] = 0;
  }
  hull(S);
}

export function setup(params) {
  const F = 16 * NMAX + 64;
  params.s = {
    n: 0, hue: 0, speed: 2, heat: 0.06, turn: 0, acc: 0, warm: false,
    X: new Float64Array(3 * NMAX), F: new Float64Array(3 * NMAX), M: new Float64Array(3 * NMAX), V: new Float64Array(3 * NMAX), U: new Float64Array(3 * NMAX),
    fa: new Int32Array(F), fb: new Int32Array(F), fc: new Int32Array(F), fx: new Float64Array(F), fy: new Float64Array(F), fz: new Float64Array(F), fd: new Float64Array(F), vis: new Uint8Array(F),
    E: new Int32Array(NMAX * NMAX), ta: new Int32Array(2 * NMAX), tb: new Int32Array(2 * NMAX), tc: new Int32Array(2 * NMAX), nt: 0,
    deg: new Int32Array(NMAX), f5: new Float32Array(NMAX), f7: new Float32Array(NMAX),
    R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H), c: [0, 0, 0, 0, 0, 0],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, NMIN, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.heat = cl(k[3], 0, 1);
  const n = round(cl(k[2], NMIN, NMAX)), kick = 0.075 * S.heat;
  if (!S.warm) {
    S.n = n;
    settle(S);
    S.warm = true;
  } else if (n !== S.n) resize(S, n);
  if (input.btnPressed && input.btnPressed[0]) {
    scatter(S.X, 0, S.n);
    S.M.fill(0);
    S.V.set(S.X.subarray(0, 3 * S.n));
    S.U.set(S.X.subarray(0, 3 * S.n));
    hull(S);
  }
  // 30 steps a second for each unit of Speed, at most six a frame.
  S.acc += d * S.speed * 30;
  let steps = min(6, floor(S.acc));
  S.acc -= floor(S.acc);
  for (; steps > 0; steps--) {
    relax(S, kick, 0.5);
    smooth(S, 0.15);
  }
  maintain(S);
  degrees(S);
  const ease = 1 - exp(-d / 0.08);
  for (let i = 0; i < S.n; i++) {
    S.f5[i] += ease * ((S.deg[i] < 6 ? 1 : 0) - S.f5[i]);
    S.f7[i] += ease * ((S.deg[i] > 6 ? 1 : 0) - S.f7[i]);
  }
  S.turn += d * S.speed * 0.1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { U, R, G, B, c, f5, f7 } = S, n = S.n;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  // The sphere turns about an axis leaning 20 degrees toward the viewer.
  const ct = cos(S.turn), st = sin(S.turn), cx = cos(0.35), sx = sin(0.35);
  const h = S.hue + 0.55;
  // Each charge is one soft gaussian glow. Its colour runs from nearly white
  // at the centre to the full hue at the rim: hsv(hue, s, 1) is white less s
  // times (1 - the pure hue), and s falls with the square of the glow.
  const T = TYPES.map(([dh, sr, sc, lv]) => {
    const q = [0, 0, 0];
    hsv(h + dh, 1, 1, q);
    return [1 - q[0], 1 - q[1], 1 - q[2], sr, sr - sc, lv];
  });
  const sp = spacing(n) * RS, sig = min(SIG, 0.2 * sp);
  for (let i = 0; i < n; i++) {
    const x0 = U[3 * i], y0 = U[3 * i + 1], z0 = U[3 * i + 2];
    const x1 = ct * x0 + st * z0, z1 = -st * x0 + ct * z0;
    const y = cx * y0 - sx * z1, z = sx * y0 + cx * z1, x = x1;
    if (z < -0.02) continue;
    const t = cl((z + 0.02) / 0.37, 0, 1), w = t * t * (3 - 2 * t);
    const a5 = f5[i], a7 = f7[i], a6 = 1 - a5 - a7;
    for (let j = 0; j < 6; j++) c[j] = T[0][j] * a6 + T[1][j] * a5 + T[2][j] * a7;
    const L = c[5] * w * (0.55 + 0.45 * z), s = sig * (1 + 0.25 * (a5 + a7));
    // Foreshortened toward the rim: narrower across the radius.
    const px = CX + RS * x, py = CY - RS * y, rr = sqrt(x * x + y * y) || 1, rx = x / rr, ry = -y / rr;
    const sr = s * (0.45 + 0.55 * z), ir = 1 / (2 * sr * sr), it = 1 / (2 * s * s), ext = 3 * s;
    for (let yy = max(0, floor(py - ext)); yy <= min(H - 1, py + ext); yy++)
      for (let xx = max(0, floor(px - ext)); xx <= min(W - 1, px + ext); xx++) {
        const dx = xx - px, dy = yy - py, dr = dx * rx + dy * ry, dq = -dx * ry + dy * rx;
        const g = exp(-dr * dr * ir - dq * dq * it), v = L * g, sat = v * (c[3] - c[4] * g * g * g), p = yy * W + xx;
        R[p] += v - sat * c[0];
        G[p] += v - sat * c[1];
        B[p] += v - sat * c[2];
      }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      display.setPixel(x, y, round(min(255, R[p])), round(min(255, G[p])), round(min(255, B[p])));
    }
}
