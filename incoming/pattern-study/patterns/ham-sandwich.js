// ===== Patternflow pattern =====
// Title:   Ham Sandwich
// Family:  topology
// Idea:    Two clouds of 4,401 crumbs each, cyan bread and magenta ham, drift round each other, stretch, split and merge, and every frame one straight knife through one crumb of each leaves 2,200 of each cloud on either side, the crumbs on one side lit bright and on the other dim.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: ham sandwich theorem (Arthur Stone and John Tukey, 1942)
// Round:   44
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..6, Thin=0..1, Scatter=0..1
//
// Knob 1: Hue. The two clouds' colours. At 0 the bread is cyan and the ham magenta, at 0.14 azure and rose, at 0.64 green and blue, and back to cyan and magenta at 1. They stay between green and rose because red, orange and yellow turn brown on the dim side of the knife.
// Knob 2: Speed. At 2 the clouds go once round each other in 10 seconds and each cloud's two lobes part and meet again every 7.7 seconds; at 0.2 everything takes ten times as long, at 6 a third as long.
// Knob 3: Thin. Crumbs in each cloud, always an odd number: 4,401 at 0, 2,401 at 0.5, 401 at 1. At 0 the clouds fill the panel with a checkerboard stipple; at 1 the crumbs stand apart and the knife can be seen to pass between them.
// Knob 4: Scatter. The share of crumbs that leave their cloud for a place of their own anywhere on the panel: about 4% at the start, all of them at 1, when bread and ham are two even sprinklings over the whole panel and the knife still halves both.

const W = 64, H = 128;
const { floor, round, min, abs, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => {
  const t = cl(v, 0, 1);
  return t * t * (3 - 2 * t);
};

// Crumbs in each cloud at Thin 0 and at Thin 1.
const NMAX = 4401, NMIN = 401;
// The bread's hue sweeps HUE_LO..HUE_LO + HUE_SPAN as Hue turns, cyan (0.52)
// at Hue 0; the ham stays GAP round the wheel from it.
const HUE_LO = 0.32, HUE_SPAN = 0.28, GAP = 0.34, HUE_U0 = 0.357;
// Level of a crumb on the bright side and the dim side of the knife.
const BRIGHT = 1, DIM = 0.38;
// Level of the glow round a crumb on the bright side.
const GLOW = 0.4;
// Half width of the knife in LEDs.
const KNIFE = 2.0;
// One orbit of the two clouds round each other, in seconds at Speed 2, and
// the orbit's half axes in LEDs.
const ORBIT = 10, RX = 13, RY = 32;
// The orbit's angle at the start.
const PHASE0 = -0.9 * PI;
// Most distance between a cloud's two lobes, in LEDs.
const SPLIT = 26;
// A lobe's half axes in LEDs: long LA +- LA1, short LB +- LB1; how far its rim frays.
const LA = 32, LA1 = 5, LB = 21, LB1 = 3, FRAY = 0.3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A crumb's place in its lobe: even over the unit disk, its rim frayed.
function inDisk() {
  const r = sqrt(Math.random()) * (1 + FRAY * (Math.random() + Math.random() - 1)), a = TAU * Math.random();
  return [r * cos(a), r * sin(a)];
}

function cloud() {
  const C = {
    gx: new Float32Array(NMAX), gy: new Float32Array(NMAX), w: new Float32Array(NMAX), lobe: new Uint8Array(NMAX),
    ux: new Float32Array(NMAX), uy: new Float32Array(NMAX), rank: new Float32Array(NMAX), ph: new Float32Array(NMAX),
    x: new Float64Array(NMAX), y: new Float64Array(NMAX), lobes: [new Float64Array(6), new Float64Array(6)],
  };
  for (let i = 0; i < NMAX; i++) {
    const [a, b] = inDisk();
    C.gx[i] = a;
    C.gy[i] = b;
    C.w[i] = (0.15 + 0.35 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    C.lobe[i] = Math.random() < 0.5 ? 1 : 0;
    C.ux[i] = Math.random() * W;
    C.uy[i] = Math.random() * H;
    C.rank[i] = Math.random();
    C.ph[i] = Math.random() * TAU;
  }
  return C;
}

export function setup(params) {
  params.s = {
    A: cloud(), B: cloud(), nA: NMAX, nB: NMAX, tau: 0, hue: 0, scatter: 0.06, th: 0,
    proj: new Float64Array(NMAX), idx: new Int32Array(NMAX), idxN: 0, m: 0, med: 0,
    line: { ax: 0, ay: 0, nx: 1, ny: 0, ia: 0, ib: 0 },
    rgb: new Float32Array(W * H * 3), c: new Float32Array(12),
  };
}

const odd = (v) => {
  const n = round(v);
  return n % 2 ? n : n + 1;
};

// Place the crumbs of cloud C (centre cx, cy) at time tau.
function place(C, n, cx, cy, tau, k, scatter) {
  const split = SPLIT * (0.5 - 0.5 * cos((TAU * tau) / 7.7 + k * 2.1));
  const beta = (TAU * tau) / 17 + k * 1.3;
  const dx = 0.5 * split * cos(beta), dy = 0.5 * split * sin(beta);
  for (let L = 0; L < 2; L++) {
    // Each lobe is a disk stretched to an ellipse that breathes and turns.
    const sa = LA + LA1 * sin((TAU * tau) / 9.1 + k + L * 2), sb = LB + LB1 * sin((TAU * tau) / 6.3 + 2 * k + L);
    const phi = (TAU * tau) / 13 + k * 0.7 + L * 1.9;
    C.lobes[L].set([cx + (L ? dx : -dx), cy + (L ? dy : -dy), sa, sb, cos(phi), sin(phi)]);
  }
  for (let i = 0; i < n; i++) {
    // Each crumb also circles inside its lobe at its own pace.
    const [lx, ly, sa, sb, pc, ps] = C.lobes[C.lobe[i]];
    const sw = C.w[i] * tau, swc = cos(sw), sws = sin(sw);
    const gx = C.gx[i] * swc - C.gy[i] * sws, gy = C.gx[i] * sws + C.gy[i] * swc;
    const ex = gx * sa, ey = gy * sb;
    let x = lx + ex * pc - ey * ps, y = ly + ex * ps + ey * pc;
    const u = sm((1.04 * scatter - C.rank[i]) / 0.04);
    if (u > 0) {
      const sx = C.ux[i] + 6 * sin(0.4 * tau + C.ph[i]), sy = C.uy[i] + 10 * cos(0.3 * tau + C.ph[i]);
      x += (sx - x) * u;
      y += (sy - y) * u;
    }
    // Mirror back off the panel's edges.
    if (x < 0) x = -x;
    if (x >= W) x = 2 * W - x;
    if (y < 0) y = -y;
    if (y >= H) y = 2 * H - y;
    C.x[i] = cl(x, 0.001, W - 0.001);
    C.y[i] = cl(y, 0.001, H - 0.001);
  }
}

// The index of the k-th smallest key among idx[0..n-1] (Hoare's select).
function select(idx, key, n, k) {
  let lo = 0, hi = n - 1;
  while (hi > lo) {
    const pv = key[idx[(lo + hi) >> 1]];
    let i = lo, j = hi;
    while (i <= j) {
      while (key[idx[i]] < pv) i++;
      while (key[idx[j]] > pv) j--;
      if (i <= j) {
        const t = idx[i];
        idx[i] = idx[j];
        idx[j] = t;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  return idx[k];
}

// For the normal at angle th: the bread crumb at the median of the
// projections (left in S.m, its projection in S.med), and how many ham
// crumbs lie above the line through it minus how many lie below. idx keeps
// last call's order, so the select starts nearly done.
function halve(S, th) {
  const { A, B, nA, nB, proj, idx } = S, c = cos(th), s = sin(th), ax = A.x, ay = A.y, bx = B.x, by = B.y;
  for (let i = 0; i < nA; i++) proj[i] = c * ax[i] + s * ay[i];
  const m = select(idx, proj, nA, (nA - 1) >> 1), med = proj[m];
  let g = 0;
  for (let j = 0; j < nB; j++) {
    const v = c * bx[j] + s * by[j] - med;
    g += v > 0 ? 1 : v < 0 ? -1 : 0;
  }
  S.m = m;
  S.med = med;
  return g;
}

// The cut, searched for near last frame's angle so the knife does not jump
// from one cut to another. g(th + pi) = -g(th), so g changes sign within
// pi/2 of any angle.
const STEPS = [0.02, 0.06, 0.15, 0.35, 0.8, PI / 2];
function cut(S) {
  if (S.idxN !== S.nA) {
    for (let i = 0; i < S.nA; i++) S.idx[i] = i;
    S.idxN = S.nA;
  }
  let lo = S.th, hi = NaN;
  const g0 = halve(S, lo);
  if (g0 === 0) return finish(S, lo, lo);
  outer: for (const sgn of [1, -1]) {
    let prev = lo;
    for (const d of STEPS) {
      const t = S.th + sgn * d, g = halve(S, t);
      if (g === 0) return finish(S, t, t);
      if (g * g0 < 0) {
        (lo = prev), (hi = t);
        break outer;
      }
      prev = t;
    }
  }
  if (hi !== hi) hi = lo + PI;
  // Halve the bracket until it is narrow, then until the median bread crumb
  // is the same at both ends and one ham crumb crosses between them.
  for (let it = 0; it < 80; it++) {
    if (abs(hi - lo) < 2e-6 && finish(S, lo, hi)) return;
    const mid = 0.5 * (lo + hi), g = halve(S, mid);
    if (g === 0) return finish(S, mid, mid);
    if (g * g0 > 0) lo = mid;
    else hi = mid;
  }
  finish(S, lo, hi, true);
}

// Between th0 and th1 the line through the median bread crumb turns across
// one ham crumb. The knife is the line through those two crumbs.
function finish(S, th0, th1, force) {
  const { A, B, nB } = S;
  halve(S, th0);
  const m0 = S.m, med0 = S.med;
  halve(S, th1);
  const m1 = S.m, med1 = S.med;
  const c0 = cos(th0), s0 = sin(th0), c1 = cos(th1), s1 = sin(th1);
  let ib = -1, crossed = 0, best = 1e9;
  for (let j = 0; j < nB; j++) {
    const v0 = c0 * B.x[j] + s0 * B.y[j] - med0, v1 = c1 * B.x[j] + s1 * B.y[j] - med1;
    if (v0 * v1 <= 0) {
      crossed++;
      if (best > 0) (best = 0), (ib = j);
    } else if (min(abs(v0), abs(v1)) < best) (best = min(abs(v0), abs(v1))), (ib = j);
  }
  if (!force && (m0 !== m1 || crossed !== 1)) return false;
  const th = 0.5 * (th0 + th1), ia = m0;
  const ax = A.x[ia], ay = A.y[ia], bx = B.x[ib], by = B.y[ib];
  let nx = cos(th), ny = sin(th);
  const L = sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  if (L > 1e-6) {
    // The normal of the line through both crumbs, turned to face like th's.
    let qx = -(by - ay) / L, qy = (bx - ax) / L;
    if (qx * nx + qy * ny < 0) (qx = -qx), (qy = -qy);
    (nx = qx), (ny = qy);
  }
  S.th = th;
  Object.assign(S.line, { ax, ay, nx, ny, ia, ib });
  return true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.tau += (d * cl(k[1], 0.2, 6)) / 2;
  S.nA = S.nB = odd(NMAX - (NMAX - NMIN) * cl(k[2], 0, 1));
  S.scatter = cl(k[3], 0, 1);
  const w = PHASE0 + (TAU * S.tau) / ORBIT + 0.35 * sin((TAU * S.tau) / 23);
  const rx = RX + 3 * sin((TAU * S.tau) / 11), ry = RY + 5 * sin((TAU * S.tau) / 14.5);
  place(S.A, S.nA, W / 2 + rx * cos(w), H / 2 + ry * sin(w), S.tau, 0, S.scatter);
  place(S.B, S.nB, W / 2 - rx * cos(w), H / 2 - ry * sin(w), S.tau, 1, S.scatter);
  cut(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rgb, c, A, B, nA, nB, line } = S;
  rgb.fill(0);
  // Hue runs the bread up and down HUE_LO..HUE_LO + HUE_SPAN and the ham
  // GAP behind it, both between green and pink: red, orange and yellow
  // turn brown on the dim side.
  const u = (S.hue + HUE_U0) % 1, ha = HUE_LO + HUE_SPAN * (1 - abs(2 * u - 1)), hb = ha + GAP;
  hsv(ha, 0.85, BRIGHT, c, 0);
  hsv(ha, 0.9, DIM, c, 3);
  hsv(hb, 0.75, BRIGHT, c, 6);
  hsv(hb, 0.9, DIM, c, 9);
  const { ax, ay, nx, ny } = line;
  // Crumbs sit on the white squares of a checkerboard of LEDs (x + y even);
  // one off it steps to the nearer neighbour on it. A crumb on the bright
  // side lights its four neighbours at GLOW.
  const spot = (C, i) => {
    const x = C.x[i], y = C.y[i];
    let X = x | 0, Y = y | 0;
    if ((X + Y) & 1) {
      const fx = x - X - 0.5, fy = y - Y - 0.5;
      if (abs(fx) > abs(fy)) X += fx > 0 ? (X < W - 1 ? 1 : -1) : X > 0 ? -1 : 1;
      else Y += fy > 0 ? (Y < H - 1 ? 1 : -1) : Y > 0 ? -1 : 1;
    }
    return Y * W + X;
  };
  const glow = (C, n, o) => {
    const r = c[o] * GLOW, g = c[o + 1] * GLOW, b = c[o + 2] * GLOW;
    const put = (p) => {
      (rgb[3 * p] = r), (rgb[3 * p + 1] = g), (rgb[3 * p + 2] = b);
    };
    for (let i = 0; i < n; i++) {
      if (nx * (C.x[i] - ax) + ny * (C.y[i] - ay) <= 0) continue;
      const p = spot(C, i), X = p % W;
      if (X > 0) put(p - 1);
      if (X < W - 1) put(p + 1);
      if (p >= W) put(p - W);
      if (p < W * (H - 1)) put(p + W);
    }
  };
  const dot = (C, n, o) => {
    for (let i = 0; i < n; i++) {
      const q = nx * (C.x[i] - ax) + ny * (C.y[i] - ay) > 0 ? o : o + 3, p = spot(C, i) * 3;
      rgb[p] = c[q];
      rgb[p + 1] = c[q + 1];
      rgb[p + 2] = c[q + 2];
    }
  };
  glow(A, nA, 0);
  glow(B, nB, 6);
  dot(A, nA, 0);
  dot(B, nB, 6);
  // The knife.
  for (let y = 0, p = 0; y < H; y++)
    for (let x = 0; x < W; x++, p += 3) {
      const dd = abs(nx * (x + 0.5 - ax) + ny * (y + 0.5 - ay));
      if (dd < KNIFE) (rgb[p] = 1), (rgb[p + 1] = 0.95), (rgb[p + 2] = 0.8);
    }
  // The two crumbs the knife passes through: white, in a hole in the blade
  // ringed in their cloud's colour.
  for (const [C, i, o] of [[A, line.ia, 0], [B, line.ib, 6]]) {
    const p0 = spot(C, i), x = p0 % W, y = (p0 - x) / W;
    for (let v = -3; v <= 3; v++)
      for (let u = -3; u <= 3; u++) {
        const r = u * u + v * v, X = x + u, Y = y + v;
        if (r > 13 || X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const p = (Y * W + X) * 3, m = r === 0 ? -1 : r < 7 ? 0 : 1;
        rgb[p] = m < 0 ? 1 : c[o] * m;
        rgb[p + 1] = m < 0 ? 1 : c[o + 1] * m;
        rgb[p + 2] = m < 0 ? 1 : c[o + 2] * m;
      }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, rgb[o] * 255, rgb[o + 1] * 255, rgb[o + 2] * 255);
}
