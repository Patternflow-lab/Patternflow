// ===== Patternflow pattern =====
// Title:   Square Peg
// Family:  topology
// Idea:    A closed curve wobbles and twists its lobes into curling arms without ever crossing itself, and every frame all the squares with their four corners on it are found afresh and drawn as bright outlines over its dim inside, born and dying in pairs as it changes while their count stays odd.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: inscribed square problem (Otto Toeplitz, 1911), solved for smooth curves (Lev Schnirelmann, 1929); inscribed rectangles of every aspect ratio (Joshua Greene and Andrew Lobb, 2020), pattern round 49
// Round:   49
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ratio=1..3, Wobble=0..1
//
// Knob 1: Hue. Moves the whole palette along a strip of the wheel from green through cyan, blue and violet to rose, leaving out red, orange and yellow, which go brown and olive when dim: at 0 the curve's inside is deep blue and its squares green, violet and rose; at 0.28 the inside is rose and the squares green to violet; at 0.78 the inside is green and the squares cyan to rose; at 1 blue again.
// Knob 2: Speed. At 2 each lobe swells and shrinks every 13 to 25 seconds while it turns, and the twist swings from one side to the other and back in 33 seconds; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Ratio. The aspect ratio of the rectangles sought: at 1 squares, at 2 rectangles twice as long as they are wide, at 3 three times. Each square at 1 becomes two rectangles as the ratio leaves it, so away from 1 the count is even in more than nine frames of ten.
// Knob 4: Wobble. How far the curve folds: at 0.06 its lobes reach 0.41 of the mean radius in and out and the twist turns its outermost points up to 2.5 radians past its innermost, and one to five squares stand on it; at 1 the lobes reach 0.5 and the twist 3.6 radians, the arms curl over the valleys between them, and up to 23 squares stand at once.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, sin, cos, atan2, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// Every colour comes off a strip of the wheel that skips red, orange and
// yellow, which turn brown and olive when dim: u from 0 to 1 runs green,
// cyan, blue, violet, magenta to rose.
const wheel = (u) => 0.34 + 0.63 * u;

// The curve. In its own plane it is star-shaped, r0(th) = 1 + four Fourier
// lobes; then a twist turns each point by tau * rho^2 about the centre, a
// smooth map of the plane onto itself with a smooth inverse, so the image
// is still a simple closed curve however far it curls; then it is
// stretched to stand 2:1 on the panel. Its implicit function, phi(x) =
// rho - r0(angle - tau * rho^2) after undoing the stretch, is zero exactly
// on the curve and negative inside, and angle - tau * rho^2 of a point on
// the curve is its parameter.
const MODES = [2, 3, 4, 5], WEIGHT = [0.22, 0.36, 0.26, 0.16];
const CX = 32, CY = 64, HALF_W = 29.5, HALF_H = 61.5;
// Curve samples for the search and for drawing, and the r0 table.
const M = 128, MD = 480, TAB = 1024;
// The search drops candidate pairs this close along the curve (the trivial
// squares of side 0) and solutions with a side under MIN_SIDE LEDs.
const NEAR = 2, MIN_SIDE = 3;
// Seconds a square born or dying flashes; frames a square may go unfound
// before it counts as dead.
const FLASH = 0.6, MISS = 2;

export function setup(params) {
  const R = Math.random;
  params.s = {
    // Each lobe: rate and phase of its swell, rate and start of its turn.
    nu: MODES.map(() => 0.25 + 0.25 * R()), c0: MODES.map(() => TAU * R()),
    mu: MODES.map((k, i) => (i % 2 ? -1 : 1) * (0.08 + 0.12 * R()) * (3 / k)), p0: MODES.map(() => TAU * R()),
    amp: new Float64Array(4), ph: new Float64Array(4), ac: new Float64Array(4), as: new Float64Array(4),
    t: 0.5, hue: 0.5, speed: 1.5, ratio: 1.5, wob: 0.06, tau: 0.5, sx: 20.5, sy: 40.5,
    tab: new Float64Array(TAB + 1), phi: new Float32Array(N), ring: new Uint8Array(N),
    px: new Float64Array(M), py: new Float64Array(M), f1: new Float32Array(M * M), f2: new Float32Array(M * M), done: new Uint8Array(M * M),
    sq: [], ghosts: [], next: 0, first: true, gp: new Float64Array(4), gq: new Float64Array(4),
    // What the search found: frames searched at ratio 1, frames with a
    // square, frames with an odd count, the largest corner residual in
    // LEDs, and how many frames had each count.
    stat: { frames: 0, found: 0, odd: 0, res: 0, hist: {} },
    rgb: new Float32Array(N * 3), col: new Float64Array(3), pal: new Float64Array(24),
  };
}

// r0 exactly, for the solver and the drawn line; the table, for the field.
// The lobes are cos(k th - ph) for k = 2..5, built from cos th and sin th
// by the multiple-angle recurrence, with a * cos ph and a * sin ph kept per
// frame. The slope dr0/dth is left in RD.
let RD = 0;
function r0(S, th) {
  const c1 = cos(th), s1 = sin(th), ac = S.ac, as = S.as;
  let ck = c1 * c1 - s1 * s1, sk = 2 * s1 * c1, r = 1 + ac[0] * ck + as[0] * sk, dr = 2 * (as[0] * ck - ac[0] * sk);
  for (let m = 1; m < 4; m++) {
    const c = ck * c1 - sk * s1;
    sk = sk * c1 + ck * s1;
    ck = c;
    r += ac[m] * ck + as[m] * sk;
    dr += (m + 2) * (as[m] * ck - ac[m] * sk);
  }
  RD = dr;
  return r;
}
// The curve's point at parameter s and its velocity, in LEDs.
function gamma(S, s, out) {
  const r = r0(S, s), dr = RD, a = s + S.tau * r * r, da = 1 + 2 * S.tau * r * dr, ca = cos(a), sa = sin(a);
  out[0] = CX + S.sx * r * ca;
  out[1] = CY + S.sy * r * sa;
  out[2] = S.sx * (dr * ca - r * sa * da);
  out[3] = S.sy * (dr * sa + r * ca * da);
}
// The field and its slope per LED.
function phiAt(S, x, y, g) {
  const X = (x - CX) / S.sx, Y = (y - CY) / S.sy, rr = X * X + Y * Y, rho = sqrt(rr);
  const f = rho - r0(S, atan2(Y, X) - S.tau * rr), dr = RD;
  if (g) {
    g[0] = (X / rho - dr * (-Y / rr - 2 * S.tau * X)) / S.sx;
    g[1] = (Y / rho - dr * (X / rr - 2 * S.tau * Y)) / S.sy;
  }
  return f;
}
// atan2 to within 1e-5 rad, for the per-LED field only; the solver uses
// the exact one.
function fatan2(y, x) {
  const ax = abs(x), ay = abs(y), a = min(ax, ay) / (max(ax, ay) || 1), q = a * a;
  let r = ((-0.0464964749 * q + 0.15931422) * q - 0.327622764) * q * a + a;
  if (ay > ax) r = 1.57079637 - r;
  if (x < 0) r = 3.14159274 - r;
  return y < 0 ? -r : r;
}
function paramOf(S, x, y) {
  const X = (x - CX) / S.sx, Y = (y - CY) / S.sy, a = atan2(Y, X) - S.tau * (X * X + Y * Y);
  return a - floor(a / TAU) * TAU;
}

// The rectangle on side p(s) -> q(t), its other side Ratio times as long:
// corners in o[0..7], the field at the two far corners in o[8], o[9] (both
// zero is a rectangle), and their slopes in s and t in o[10..13].
const GR = new Float64Array(2), GU = new Float64Array(2);
function corners(S, s, t, o) {
  const P = S.gp, Q = S.gq, k = S.ratio;
  gamma(S, s, P);
  gamma(S, t, Q);
  const jx = -(Q[1] - P[1]) * k, jy = (Q[0] - P[0]) * k;
  (o[0] = P[0]), (o[1] = P[1]), (o[2] = Q[0]), (o[3] = Q[1]);
  (o[4] = Q[0] + jx), (o[5] = Q[1] + jy), (o[6] = P[0] + jx), (o[7] = P[1] + jy);
  o[8] = phiAt(S, o[4], o[5], GR);
  o[9] = phiAt(S, o[6], o[7], GU);
  // r = q + kJ(q - p) and u = p + kJ(q - p), J the quarter turn.
  o[10] = GR[0] * k * P[3] - GR[1] * k * P[2];
  o[11] = GR[0] * (Q[2] - k * Q[3]) + GR[1] * (Q[3] + k * Q[2]);
  o[12] = GU[0] * (P[2] + k * P[3]) + GU[1] * (P[3] - k * P[2]);
  o[13] = -GU[0] * k * Q[3] + GU[1] * k * Q[2];
}

// Newton's method on (s, t) from a cell of the search grid.
const V = new Float64Array(14);
function solve(S, s, t) {
  for (let it = 0; it < 14; it++) {
    corners(S, s, t, V);
    if (abs(V[8]) + abs(V[9]) < 1e-13) return true;
    // Near the diagonal s = t every corner falls on p, the square of side 0,
    // and a start drawn toward it is given up.
    if (it >= 2 && abs(V[2] - V[0]) + abs(V[3] - V[1]) < MIN_SIDE / 2) return false;
    const a = V[10], b = V[11], c = V[12], d = V[13], det = a * d - b * c;
    if (!det) return false;
    let ds = (d * V[8] - b * V[9]) / det, dt = (a * V[9] - c * V[8]) / det;
    const step = max(abs(ds), abs(dt));
    if (step > 0.06) (ds *= 0.06 / step), (dt *= 0.06 / step);
    s -= ds;
    t -= dt;
  }
  return false;
}

function search(S) {
  const { px, py, f1, f2, done, phi: F } = S, k = S.ratio;
  for (let i = 0; i < M; i++) {
    gamma(S, (TAU * i) / M, S.gp);
    (px[i] = S.gp[0]), (py[i] = S.gp[1]);
  }
  // The field at each far corner, read between LED centres; off the panel
  // is outside.
  for (let i = 0; i < M; i++) {
    const xi = px[i], yi = py[i];
    for (let j = 0; j < M; j++) {
      const jx = -(py[j] - yi) * k, jy = (px[j] - xi) * k, o = i * M + j;
      for (let c = 0; c < 2; c++) {
        const x = (c ? xi : px[j]) + jx - 0.5, y = (c ? yi : py[j]) + jy - 0.5;
        let f = 0.5;
        if (x > -0.5 && x < W - 0.5 && y > -0.5 && y < H - 0.5) {
          const gx = x < 0 ? 0 : x > W - 1.001 ? W - 1.001 : x, gy = y < 0 ? 0 : y > H - 1.001 ? H - 1.001 : y;
          const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, n = iy * W + ix;
          f = (F[n] + (F[n + 1] - F[n]) * fx) * (1 - fy) + (F[n + W] + (F[n + W + 1] - F[n + W]) * fx) * fy;
        }
        if (c) f2[o] = f;
        else f1[o] = f;
      }
    }
  }
  done.fill(0);
  // A cell where both far corners cross the curve may hold a solution.
  // Newton starts where the two fields, each taken as a plane through the
  // cell, cross, kept to within a cell of it. Each rectangle turns up once
  // per side that can be p -> q, four for a square and two otherwise, so
  // once one is found the cells of the others are done.
  const found = [], sqr = abs(k - 1) < 1e-9, period = sqr ? PI / 2 : PI;
  const mark = (a, b) => (done[floor((a / TAU) * M) * M + floor((b / TAU) * M)] = 1);
  for (let i = 0; i < M; i++) {
    const i1 = (i + 1) % M;
    for (let j = 0; j < M; j++) {
      const gap = abs(i - j), a = i * M + j;
      if (min(gap, M - gap) <= NEAR || done[a]) continue;
      const j1 = (j + 1) % M, b = i * M + j1, c = i1 * M + j, d = i1 * M + j1;
      const A1 = f1[a], B1 = f1[b], C1 = f1[c], D1 = f1[d], A2 = f2[a], B2 = f2[b], C2 = f2[c], D2 = f2[d];
      if ((A1 > 0) === (B1 > 0) && (A1 > 0) === (C1 > 0) && (A1 > 0) === (D1 > 0)) continue;
      if ((A2 > 0) === (B2 > 0) && (A2 > 0) === (C2 > 0) && (A2 > 0) === (D2 > 0)) continue;
      const m1 = (A1 + B1 + C1 + D1) / 4, u1 = (C1 + D1 - A1 - B1) / 2, w1 = (B1 + D1 - A1 - C1) / 2;
      const m2 = (A2 + B2 + C2 + D2) / 4, u2 = (C2 + D2 - A2 - B2) / 2, w2 = (B2 + D2 - A2 - C2) / 2, det = u1 * w2 - w1 * u2;
      if (!det) continue;
      const di = cl((-m1 * w2 + w1 * m2) / det, -1, 1), dj = cl((-u1 * m2 + m1 * u2) / det, -1, 1);
      if (!solve(S, (TAU * (i + 0.5 + di)) / M, (TAU * (j + 0.5 + dj)) / M)) continue;
      const len = hypot(V[2] - V[0], V[3] - V[1]);
      if (len < MIN_SIDE) continue;
      const v = Array.from(V.subarray(0, 8)), ps = [0, 1, 2, 3].map((q) => paramOf(S, v[2 * q], v[2 * q + 1]));
      for (let q = 0; q < 4; q += sqr ? 1 : 2) mark(ps[q], ps[(q + 1) % 4]);
      const cx = (v[0] + v[2] + v[4] + v[6]) / 4, cy = (v[1] + v[3] + v[5] + v[7]) / 4;
      let ang = atan2(v[3] - v[1], v[2] - v[0]) % period;
      if (ang < 0) ang += period;
      let dup = false;
      for (const f of found) {
        let da = abs(f.ang - ang);
        da = min(da, period - da);
        if (abs(f.cx - cx) < 0.05 && abs(f.cy - cy) < 0.05 && abs(f.len - len) < 0.05 && da < 0.005) dup = true;
      }
      if (!dup) found.push({ cx, cy, len, ang, v });
    }
  }
  return found;
}

// Each square found takes the id and age of the nearest one last frame;
// the rest are born. One unfound for more than MISS frames dies.
function track(S, found, dt) {
  const old = S.sq, used = new Uint8Array(old.length), next = [];
  for (const f of found) {
    let best = -1, bc = 4;
    old.forEach((o, i) => {
      if (used[i]) return;
      const c = hypot(o.cx - f.cx, o.cy - f.cy) + abs(o.len - f.len);
      if (c < bc) (bc = c), (best = i);
    });
    if (best >= 0) (used[best] = 1), (f.id = old[best].id), (f.age = old[best].age + dt);
    else (f.id = S.next++), (f.age = S.first ? 9 : 0);
    f.miss = 0;
    next.push(f);
  }
  old.forEach((o, i) => {
    if (used[i]) return;
    if (++o.miss > MISS) S.ghosts.push({ v: o.v, life: FLASH });
    else (o.age += dt), next.push(o);
  });
  for (const g of S.ghosts) g.life -= dt;
  S.ghosts = S.ghosts.filter((g) => g.life > 0);
  S.sq = next;
  S.first = false;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.ratio = cl(kv[2], 1, 3);
  S.wob = cl(kv[3], 0, 1);
  S.t += (d * S.speed) / 2;
  const t = S.t, A = 0.4 + 0.1 * S.wob;
  for (let m = 0; m < 4; m++) {
    S.amp[m] = A * WEIGHT[m] * (0.7 + 0.3 * sin(S.nu[m] * t + S.c0[m]));
    S.ph[m] = S.p0[m] + S.mu[m] * t;
    (S.ac[m] = S.amp[m] * cos(S.ph[m])), (S.as[m] = S.amp[m] * sin(S.ph[m]));
  }
  let rmax = 0;
  for (let i = 0; i <= TAB; i++) rmax = max(rmax, (S.tab[i] = r0(S, (TAU * i) / TAB)));
  // The twist turns a point at radius 1 + A this far past one at 1 - A,
  // swinging from one side to the other; and the curve is scaled to just fit.
  S.tau = ((2.4 + 1.2 * S.wob) * sin(0.19 * t + 1.1)) / (4 * A);
  (S.sx = HALF_W / rmax), (S.sy = HALF_H / rmax);
  const F = S.phi, tab = S.tab;
  for (let y = 0; y < H; y++) {
    const Y = (y + 0.5 - CY) / S.sy;
    for (let x = 0; x < W; x++) {
      const X = (x + 0.5 - CX) / S.sx, rho2 = X * X + Y * Y;
      let u = ((fatan2(Y, X) - S.tau * rho2) / TAU) * TAB;
      u -= floor(u / TAB) * TAB;
      const iu = u | 0;
      F[y * W + x] = sqrt(rho2) - (tab[iu] + (tab[iu + 1] - tab[iu]) * (u - iu));
    }
  }
  const found = search(S);
  if (S.ratio === 1) {
    const st = S.stat;
    st.frames++;
    if (found.length) st.found++;
    if (found.length % 2) st.odd++;
    st.hist[found.length] = (st.hist[found.length] || 0) + 1;
    for (const f of found)
      for (let c = 0; c < 4; c++) {
        // A corner's distance from the curve in LEDs: the field over its slope.
        const e = abs(phiAt(S, f.v[2 * c], f.v[2 * c + 1], GR));
        st.res = max(st.res, e / hypot(GR[0], GR[1]));
      }
  }
  track(S, found, d);
}

// The inside: blue at Hue 0, along the strip to rose at 0.28, back down
// to green at 0.78 and up to blue again at 1. A square's own colour: its id
// picks a place on the rest of the strip, at least a quarter of it away
// from the inside's.
const U0 = 0.444;
const insideAt = (S) => {
  const f = (U0 + 2 * S.hue) % 2;
  return f > 1 ? 2 - f : f;
};
function squareHue(S, id) {
  const p = insideAt(S), lo = max(0, p - 0.25), x = ((id * 0.618034) % 1) * (lo + max(0, 0.75 - p));
  return wheel(x < lo ? x : x - lo + p + 0.25);
}

function line(rgb, x0, y0, x1, y1, r, g, b) {
  const n = max(1, Math.ceil(hypot(x1 - x0, y1 - y0) * 2));
  for (let q = 0; q <= n; q++) {
    const x = floor(x0 + ((x1 - x0) * q) / n), y = floor(y0 + ((y1 - y0) * q) / n);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const o = (y * W + x) * 3;
    (rgb[o] = r), (rgb[o + 1] = g), (rgb[o + 2] = b);
  }
}

// The square's inside in its own colour, except on the curve's line.
function fill(S, v, r, g, b) {
  const { rgb, ring } = S, xs = [v[0], v[2], v[4], v[6]], ys = [v[1], v[3], v[5], v[7]];
  const x0 = max(0, floor(min(...xs))), x1 = min(W - 1, floor(max(...xs))), y0 = max(0, floor(min(...ys))), y1 = min(H - 1, floor(max(...ys)));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let pos = 0, neg = 0;
      for (let c = 0; c < 4; c++) {
        const ax = xs[c], ay = ys[c], cr = (xs[(c + 1) % 4] - ax) * (py - ay) - (ys[(c + 1) % 4] - ay) * (px - ax);
        if (cr > 0) pos++;
        else neg++;
      }
      const i = y * W + x;
      if ((pos && neg) || ring[i] === 3) continue;
      (rgb[i * 3] = r), (rgb[i * 3 + 1] = g), (rgb[i * 3 + 2] = b);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, ring, phi, col } = S, hb = wheel(insideAt(S));
  // The line: the curve sampled finely, so a fold thinner than an LED still
  // draws both its sides. Then two rings round it.
  ring.fill(0);
  let a = [], b = [], x0 = 0, y0 = 0;
  for (let q = 0; q <= MD; q++) {
    gamma(S, (TAU * q) / MD, S.gp);
    const x1 = S.gp[0], y1 = S.gp[1], n = q ? Math.ceil(2 * max(abs(x1 - x0), abs(y1 - y0))) : 0;
    for (let e = 0; e <= n; e++) {
      const x = floor(x1 + ((x0 - x1) * e) / (n || 1)), y = floor(y1 + ((y0 - y1) * e) / (n || 1)), i = y * W + x;
      if (x >= 0 && x < W && y >= 0 && y < H && !ring[i]) (ring[i] = 3), a.push(i);
    }
    (x0 = x1), (y0 = y1);
  }
  for (let lv = 2; lv > 0; lv--) {
    for (const i of a) {
      const x = i % W;
      if (x > 0 && !ring[i - 1]) (ring[i - 1] = lv), b.push(i - 1);
      if (x < W - 1 && !ring[i + 1]) (ring[i + 1] = lv), b.push(i + 1);
      if (i >= W && !ring[i - W]) (ring[i - W] = lv), b.push(i - W);
      if (i < N - W && !ring[i + W]) (ring[i + W] = lv), b.push(i + W);
    }
    (a = b), (b = []);
  }
  // Inside dim and flat with a brighter band along the line; outside black
  // with a two-step halo. Five colours, no gradient. pal holds them by
  // ring outside (0..3) and then ring inside (4..7).
  const pal = S.pal, lv = [[0, 0, 0], [hb, 0.85, 0.2], [hb, 0.75, 0.42], [hb + 0.03, 0.35, 1], [hb, 0.85, 0.2], [hb, 0.8, 0.3], [hb, 0.75, 0.36], [hb + 0.03, 0.35, 1]];
  for (let c = 0; c < 8; c++) hsv(lv[c][0], lv[c][1], lv[c][2], pal, c * 3);
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const c = (ring[i] + (phi[i] < 0 ? 4 : 0)) * 3;
    (rgb[o] = pal[c]), (rgb[o + 1] = pal[c + 1]), (rgb[o + 2] = pal[c + 2]);
  }
  // Squares, largest first so small ones show on top: the inside in the
  // square's colour, then the outline, then the corners.
  const list = S.sq.slice().sort((a, b) => b.len - a.len);
  for (const f of list) {
    const h = squareHue(S, f.id);
    hsv(h, 0.8, 0.42, col, 0);
    fill(S, f.v, col[0], col[1], col[2]);
  }
  for (const f of list) {
    // Newborn squares flash white and settle into their colour.
    const v = f.v, wh = f.age < FLASH ? 1 - f.age / FLASH : 0;
    hsv(squareHue(S, f.id), 0.6 * (1 - wh), 1, col, 0);
    for (let c = 0; c < 4; c++) line(rgb, v[2 * c], v[2 * c + 1], v[(2 * c + 2) % 8], v[(2 * c + 3) % 8], col[0], col[1], col[2]);
    for (let c = 0; c < 4; c++) {
      const x = floor(v[2 * c]), y = floor(v[2 * c + 1]);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const o = (Y * W + X) * 3, core = dx === 0 && dy === 0;
        (rgb[o] = core ? 1 : col[0]), (rgb[o + 1] = core ? 1 : col[1]), (rgb[o + 2] = core ? 1 : col[2]);
      }
    }
  }
  // A square that died flashes white where it last stood, then goes.
  for (const g of S.ghosts) {
    const a = floor((g.life / FLASH) * 4) / 4 + 0.25;
    for (let c = 0; c < 4; c++) line(rgb, g.v[2 * c], g.v[2 * c + 1], g.v[(2 * c + 2) % 8], g.v[(2 * c + 3) % 8], a, a, a);
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
