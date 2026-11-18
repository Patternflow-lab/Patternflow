// ===== Patternflow pattern =====
// Title:   Lill's Method
// Family:  line
// Idea:    A polynomial's coefficients lay a right-angled polyline down the panel, and a ray swept from its start turns a right angle onto the line of each next segment, ending on the polyline's far end T only when minus the tangent of its angle is a real root, so the paths that reach T glow gold and a graph of the miss below ticks every zero, while a pair of roots is walked into a double root and on into the complex plane and the paths that reach T drop from three to one as the polyline hardly moves.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lill's method for the real roots of a polynomial (Eduard Lill, 1867), real roots isolated between the roots of the derivative, which is Rolle's theorem (Michel Rolle, 1691), 3 x 5 digits from Collatz Tree, pattern round 107
// Round:   107
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.3..3, Pair=-1..1, Degree=3..6
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the sweeping ray is cyan, the polyline runs from violet at O to azure at T, the paths that reach T go from red-orange to yellow with the angle they leave at, and the misses are magenta; at 0.5 the ray is red, the polyline lime to orange, the paths cyan to blue and the misses green.
// Knob 2: Sweep. How fast the ray turns across its 100 degrees, from 89 degrees below the first segment to 11 above it and back. At 2 one crossing of the cubic takes 2.0 s, at 0.3 it takes 13 s and at 3 it takes 1.3 s. The ray slows to 0.3 of its pace over the last 0.1 rad before each root and before the middle of the pair, and the fan it leaves fades in 0.4 s, so a fast sweep trails a longer fan.
// Knob 3: Pair. Moves two roots of the polynomial together and apart, x = 1.95 plus and minus the root of s, with s = 0.42 times the knob plus a drift of 0.14 over 12 s. At 1 the pair stands 13 to 19 degrees apart and both paths reach T. Between -0.33 and 0.33 the drift takes s through 0 every 6 s: the two paths close into one, the pair's own path turns gold for that moment, and then no path reaches T there, because the roots have left the real line. At -1 the magenta path ends short of T by 0.28 to 0.56 times what is left of the polynomial at 1.95, and two fewer paths reach T. Across the whole knob, s from -0.56 to 0.56, the last two segments of the cubic change by 15 and 30 percent end to end, while the pair goes from the roots 1.20 and 2.70 to a complex pair.
// Knob 4: Degree. How many roots the polynomial has, 3 to 6. Each step up adds a root and a segment: the root leaves x = 0, where its path lies along the polyline itself, and slides out to 0.48, 3.55 and 0.21 for degrees 4, 5 and 6 (the cubic's own is 0.89), and between whole numbers the new segment grows from zero at T. The figure keeps whichever quarter turn fits the polyline larger in the panel, and turns when the other fits 12 percent larger.

const W = 64, H = 128, NP = W * H;
const { floor, ceil, min, max, abs, sin, cos, atan, asinh, sqrt, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// The family. p(x) = ((x - M)^2 - s) (x - w1 R1) (x - w2 R2) (x - w3 R3) (x - w4 R4):
// a pair of roots M +- sqrt(s) that meets at s = 0 and leaves the real line for s < 0,
// and up to four more that each start at the root 0 (w = 0, which is the polyline itself)
// and slide out to R as the degree goes up.
const M0 = 1.95;
const EX = [0.89, 0.48, 3.55, 0.21];
const SC = 0.42, WOB = 0.14, WT = 12;
// The panel: the polyline fits in A, rays are cut at C, the graph sits in G.
const AX0 = 4, AX1 = 60, AY0 = 5, AY1 = 96;
const CY1 = 100, NS = 120;
const GX0 = 2, GX1 = 61, GY0 = 105, GY1 = 125;
const TH0 = -PI / 2 + 0.02, TH1 = 0.2;
const NB = 198;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
}

export function setup(params) {
  params.s = {
    R: new Float32Array(NP), G: new Float32Array(NP), B: new Float32Array(NP),
    c: new Float64Array(7), n: 3, P: new Float64Array(16), roots: new Float64Array(8), nr: 0,
    qx: new Float64Array(8), qy: new Float64Array(8),
    memG: new Float32Array(NB), memS: new Float32Array(NB),
    gv: new Float64Array(NS + 1),
    tt: 0, th: -1.1, dir: 1, sK: 0, s: 0, d: 3, sw: 2, hue: 0, nd: 0,
    phi: 0, phiT: 0, sc: 3, uc: 0, vc: 0, init: false, gmax: 0, y0: 0, y1: 0,
  };
}

// The polynomial for the knobs: coefficients high first, the degree n, and the polyline.
function build(S, s, d) {
  const c = S.c;
  c[0] = 1; c[1] = -2 * M0; c[2] = M0 * M0 - s;
  let deg = 2;
  for (let j = 0; j < 4; j++) {
    const r = ease(cl(d - 2 - j, 0, 1)) * EX[j];
    c[deg + 1] = 0;
    for (let k = deg + 1; k >= 1; k--) c[k] -= r * c[k - 1];
    deg++;
  }
  let n = 6;
  while (n > 2 && c[n] === 0) n--;
  S.n = n;
  const P = S.P;
  let x = 0, y = 0;
  P[0] = 0; P[1] = 0;
  for (let k = 0; k <= n; k++) {
    const q = k & 3, a = c[k];
    if (q === 0) x += a; else if (q === 1) y += a; else if (q === 2) x -= a; else y -= a;
    P[2 * k + 2] = x; P[2 * k + 3] = y;
  }
}

const horner = (c, n, x) => {
  let v = 0;
  for (let k = 0; k <= n; k++) v = v * x + c[k];
  return v;
};

// The real roots of c[0..n] in ascending order, by way of the roots of the derivative:
// between two neighbouring critical points p is monotone, so it has a root there
// exactly when it changes sign. A root sitting on a critical point is a multiple one.
function realRoots(c, n, out) {
  if (n === 1) { out[0] = -c[1] / c[0]; return 1; }
  const dc = new Float64Array(n);
  for (let k = 0; k < n; k++) dc[k] = c[k] * (n - k);
  const cr = new Float64Array(n);
  const nc = realRoots(dc, n - 1, cr);
  let B = 0;
  for (let k = 1; k <= n; k++) B = max(B, abs(c[k] / c[0]));
  B += 1;
  const pts = [-B];
  for (let i = 0; i < nc; i++) pts.push(cr[i]);
  pts.push(B);
  const f = pts.map((x) => horner(c, n, x)), zero = pts.map((x, i) => {
    let sc = 0;
    for (let k = 0; k <= n; k++) sc += abs(c[k]) * abs(x) ** (n - k);
    return i > 0 && i < pts.length - 1 && abs(f[i]) <= 1e-12 * sc;
  });
  let cnt = 0;
  const add = (x) => { if (cnt === 0 || x - out[cnt - 1] > 1e-9) out[cnt++] = x; };
  for (let i = 0; i + 1 < pts.length; i++) {
    if (zero[i]) add(pts[i]);
    if (zero[i] || zero[i + 1] || f[i] * f[i + 1] > 0) continue;
    let a = pts[i], b = pts[i + 1];
    for (let it = 0; it < 80; it++) {
      const m = (a + b) / 2;
      if (horner(c, n, m) * f[i] > 0) a = m; else b = m;
    }
    add((a + b) / 2);
  }
  return cnt;
}

// Lill's path for the launch angle th, from the origin: the ray hits the line of
// the second segment, turns a right angle there, hits the line of the third, and
// so on to the line of the last. Points in polyline units go into qx, qy.
function shoot(S, th) {
  const { P, n, qx, qy } = S;
  const ct = cos(th), st = sin(th);
  let x = 0, y = 0;
  qx[0] = 0; qy[0] = 0;
  for (let k = 1; k <= n; k++) {
    const q = (k - 1) & 3;
    const dx = q === 0 ? ct : q === 1 ? -st : q === 2 ? -ct : st;
    const dy = q === 0 ? st : q === 1 ? ct : q === 2 ? -st : -ct;
    const t = k & 1 ? (P[2 * k] - x) / dx : (P[2 * k + 1] - y) / dy;
    x += dx * t; y += dy * t;
    qx[k] = x; qy[k] = y;
  }
}

// cos^n(th) p(-tan th): the miss with the blow-up at the vertical taken out.
function homog(S, th) {
  const { c, n } = S;
  const st = -sin(th), ct = cos(th);
  let w = 0;
  for (let k = 0; k <= n; k++) w += c[k] * st ** (n - k) * ct ** k;
  return w;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 3], d = cl(dt || 0, 0, 0.1);
  S.tt += d;
  S.hue = cl(k[0], 0, 1);
  S.sw = cl(k[1], 0.3, 3);
  const kt = cl(k[2], -1, 1) * SC;
  const dT = cl(k[3], 3, 6);
  const e = S.init ? 1 - exp(-d / 0.12) : 1;
  S.sK += (kt - S.sK) * e;
  S.d += (dT - S.d) * e;
  S.s = S.sK + WOB * sin(2 * PI * (S.tt - 2.4) / WT);
  build(S, S.s, S.d);
  S.nr = realRoots(S.c, S.n, S.roots);

  // The view: the polyline's bounding box, turned by phi (0 or a quarter turn,
  // whichever fits larger), is fitted to the box A.
  const P = S.P, n = S.n;
  const box = (ph) => {
    const cp = cos(ph), sp = sin(ph);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let i = 0; i <= n + 1; i++) {
      const u = P[2 * i] * cp - P[2 * i + 1] * sp, v = P[2 * i] * sp + P[2 * i + 1] * cp;
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
    }
    return [u0, u1, v0, v1];
  };
  const fit = (b) => min((AX1 - AX0) / max(1e-6, b[1] - b[0]), (AY1 - AY0) / max(1e-6, b[3] - b[2]));
  const f0 = fit(box(0)), f1 = fit(box(PI / 2));
  if (S.phiT === 0 && f1 > f0 * 1.12) S.phiT = PI / 2;
  else if (S.phiT !== 0 && f0 > f1 * 1.12) S.phiT = 0;
  S.phi += (S.phiT - S.phi) * (S.init ? 1 - exp(-d / 0.3) : 1);
  const b = box(S.phi), fs = fit(b);
  // Zooming out is quick, so the polyline never spends long past the edge; zooming in is slow.
  const ce = S.init ? 1 - exp(-d / (fs < S.sc ? 0.07 : 0.3)) : 1;
  S.sc += (fs - S.sc) * ce;
  S.uc += ((b[0] + b[1]) / 2 - S.uc) * ce;
  S.vc += ((b[2] + b[3]) / 2 - S.vc) * ce;

  // The sweep: th runs between TH0 and TH1 and back, slowing to 0.3 of its pace
  // over the last 0.1 rad before each root and before the middle of the pair.
  let near = abs(S.th + atan(M0));
  for (let i = 0; i < S.nr; i++) if (abs(S.roots[i]) > 0.02) near = min(near, abs(S.th + atan(S.roots[i])));
  const slow = 0.3 + 0.7 * ease(near / 0.1);
  const th0 = S.th;
  S.th += S.dir * 0.55 * S.sw * slow * d;
  if (S.th > TH1) { S.th = TH1; S.dir = -1; }
  if (S.th < TH0) { S.th = TH0; S.dir = 1; }
  // What the sweep has passed stays lit for a while: a short tail for the fan of
  // rays, a long one for the roots.
  const dg = exp(-d / 0.4), ds = exp(-d / 2.4);
  for (let i = 0; i < NB; i++) { S.memG[i] *= dg; S.memS[i] *= ds; }
  const i0 = cl(floor(((min(th0, S.th) - TH0) / (TH1 - TH0)) * (NB - 1)), 0, NB - 1), i1 = cl(ceil(((max(th0, S.th) - TH0) / (TH1 - TH0)) * (NB - 1)), 0, NB - 1);
  for (let i = i0; i <= i1; i++) { S.memG[i] = 1; S.memS[i] = 1; }
  S.init = true;
}

const memAt = (m, th) => {
  const u = ((th - TH0) / (TH1 - TH0)) * (NB - 1);
  if (u < 0 || u > NB - 1) return 0;
  const i = min(NB - 2, floor(u)), f = u - i;
  return m[i] * (1 - f) + m[i + 1] * f;
};

// Antialiased line, added to what is there, cut to the box [0, 64] x [S.y0, S.y1].
function line(S, x0, y0, x1, y1, r, g, b, a) {
  if (!(abs(x0) < 1e9 && abs(y0) < 1e9 && abs(x1) < 1e9 && abs(y1) < 1e9) || a <= 0.004) return;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy], q = [x0, W - x0, y0 - S.y0, S.y1 - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return; continue; }
    const u = q[i] / p[i];
    if (p[i] < 0) { if (u > t1) return; if (u > t0) t0 = u; } else { if (u < t0) return; if (u < t1) t1 = u; }
  }
  const ax = x0 + dx * t0, ay = y0 + dy * t0, bx = x0 + dx * t1, by = y0 + dy * t1;
  const len = sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), ns = ceil(len * 2) + 1, w0 = 0.5 * a;
  const { R, G, B } = S;
  for (let s = 0; s < ns; s++) {
    const u = ns > 1 ? s / (ns - 1) : 0, x = ax + (bx - ax) * u - 0.5, y = ay + (by - ay) * u - 0.5;
    const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    for (let k = 0; k < 4; k++) {
      const px = ix + (k & 1), py = iy + (k >> 1);
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const w = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy) * w0, o = py * W + px;
      R[o] += r * w; G[o] += g * w; B[o] += b * w;
    }
  }
}

function dot(S, x, y, rad, r, g, b, a) {
  const { R, G, B } = S;
  const x0 = floor(x - rad - 1), y0 = floor(y - rad - 1), m = ceil(2 * rad + 2);
  for (let j = 0; j < m; j++) {
    const py = y0 + j;
    if (py < 0 || py >= H) continue;
    for (let i = 0; i < m; i++) {
      const px = x0 + i;
      if (px < 0 || px >= W) continue;
      const dx = px + 0.5 - x, dy = py + 0.5 - y, w = (1 - sqrt(dx * dx + dy * dy) / rad) * a;
      if (w <= 0) continue;
      const o = py * W + px, u = w > 1 ? 1 : w;
      R[o] += r * u; G[o] += g * u; B[o] += b * u;
    }
  }
}

// 3 x 5 digits.
const DIGITS = [
  "### #.# #.# #.# ###", ".#. ##. .#. .#. ###", "### ..# ### #.. ###", "### ..# ### ..# ###", "#.# #.# ### ..# ..#",
  "### #.. ### ..# ###", "### #.. ### #.# ###", "### ..# ..# .#. .#.", "### #.# ### #.# ###", "### #.# ### ..# ###",
].map((s) => {
  const rows = s.split(" "), m = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if (rows[y][x] === "#") m.push(x, y);
  return m;
});

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { R, G, B, n, P, roots, nr, qx, qy } = S;
  R.fill(0); G.fill(0); B.fill(0);
  const hu = S.hue, tmp = [0, 0, 0];
  const pal = (h, s, v) => { hsv(h + hu, s, v, tmp); return [tmp[0], tmp[1], tmp[2]]; };
  const cPoly = pal(0.66, 0.65, 0.66), cScan = pal(0.5, 0.62, 1), cMiss = pal(0.9, 0.75, 1);
  // A path that reaches T is coloured by its launch angle, so two paths of a pair that has nearly met are nearly one colour.
  const gold = (x, v) => { const u = cl(((atan(x) - 0.1) / 1.4), 0, 1); hsv(0.02 + 0.15 * u + hu, 0.78, v, tmp); return [tmp[0], tmp[1], tmp[2]]; };
  const cGold = gold(1.5, 1);
  const cp = cos(S.phi), sp = sin(S.phi), ax = (AX0 + AX1) / 2, ay = (AY0 + AY1) / 2;
  const mx = (u, v) => ax + S.sc * (u * cp - v * sp - S.uc);
  const my = (u, v) => ay - S.sc * (u * sp + v * cp - S.vc);
  S.y0 = 0; S.y1 = CY1;
  // While a new coefficient is growing, the leg that belongs to it grows in too.
  const lastA = ease(S.d - (n - 1));
  const legs = (a, col) => {
    for (let k = 1; k <= n; k++) line(S, mx(qx[k - 1], qy[k - 1]), my(qx[k - 1], qy[k - 1]), mx(qx[k], qy[k]), my(qx[k], qy[k]), col[0], col[1], col[2], k === n ? a * lastA : a);
  };
  const Tu = P[2 * n + 2], Tv = P[2 * n + 3];
  const txs = mx(Tu, Tv), tys = my(Tu, Tv);

  // The coefficients: the polyline, dim and steady, its corners a little brighter.
  // Its hue runs from violet at O to azure at T, so the order of the coefficients reads.
  for (let k = 0; k <= n; k++) {
    const cc = pal(0.74 - 0.16 * ((k + 0.5) / (n + 1)), 0.62, 0.78);
    line(S, mx(P[2 * k], P[2 * k + 1]), my(P[2 * k], P[2 * k + 1]), mx(P[2 * k + 2], P[2 * k + 3]), my(P[2 * k + 2], P[2 * k + 3]), cc[0], cc[1], cc[2], 0.9);
    if (k) dot(S, mx(P[2 * k], P[2 * k + 1]), my(P[2 * k], P[2 * k + 1]), 1.6, cc[0], cc[1], cc[2], 0.5);
  }

  // The fan the sweep leaves behind.
  const NF = 40;
  for (let i = 0; i < NF; i++) {
    const th = TH0 + ((i + 0.5) / NF) * (TH1 - TH0), m = memAt(S.memG, th);
    if (m < 0.06) continue;
    shoot(S, th);
    legs(0.5 * m ** 1.5, cScan);
  }

  // The paths that reach T.
  let flash = 0, nd = 0;
  for (let i = 0; i < nr; i++) {
    const x = roots[i], th = -atan(x), vis = ease((abs(x) - 0.02) / 0.18);
    if (vis <= 0) continue;
    nd++;
    const m = memAt(S.memS, th);
    shoot(S, th);
    legs(vis * (0.62 + 0.38 * m), gold(x, 1));
    if (vis * m > flash) flash = vis * m;
  }
  S.nd = nd;

  // The path through the middle of the pair, which ends on T only when the pair has met.
  const thM = -atan(M0), touch = exp(-((S.s / 0.035) ** 2)), cPair = cMiss.map((v, i) => v + (cGold[i] - v) * touch);
  shoot(S, thM);
  legs(0.5 + 0.5 * touch, cPair);
  line(S, txs, tys, mx(qx[n], qy[n]), my(qx[n], qy[n]), cPair[0], cPair[1], cPair[2], 0.7 * lastA);
  if (touch > flash) flash = touch;

  // The ray itself and how far it ends from T.
  shoot(S, S.th);
  legs(0.9, cScan);
  const qxs = mx(qx[n], qy[n]), qys = my(qx[n], qy[n]);
  line(S, txs, tys, qxs, qys, cMiss[0], cMiss[1], cMiss[2], lastA);
  for (let k = 1; k < n; k++) dot(S, mx(qx[k], qy[k]), my(qx[k], qy[k]), 1.5, 255, 255, 255, 0.75);
  dot(S, qxs, qys, 1.8, 255, 255, 255, 0.9 * lastA);

  // O, and T as a ring that sends out a ripple each time the sweep finds a root.
  dot(S, mx(0, 0), my(0, 0), 2, 255, 255, 255, 0.8);
  const rip = 3 + 7 * (1 - flash) ** 0.8;
  for (let j = -11; j <= 11; j++)
    for (let i = -11; i <= 11; i++) {
      const px = floor(txs) + i, py = floor(tys) + j;
      if (px < 0 || px >= W || py < 0 || py >= CY1) continue;
      const dd = sqrt((px + 0.5 - txs) ** 2 + (py + 0.5 - tys) ** 2), w = 1 - abs(dd - 3) / 0.9, w2 = (1 - abs(dd - rip) / 1.1) * flash ** 1.5 * 0.8;
      const k = max(0, w) * (0.65 + 0.35 * flash) + max(0, w2);
      if (k <= 0) continue;
      const o = py * W + px;
      R[o] += cGold[0] * k; G[o] += cGold[1] * k; B[o] += cGold[2] * k;
    }

  // The graph: cos^n p(-tan th) against th, zero crossings ticked.
  S.y0 = 101; S.y1 = H;
  const yc = (GY0 + GY1) / 2, amp = (GY1 - GY0) / 2 - 1;
  const gx = (th) => GX0 + ((th - TH0) / (TH1 - TH0)) * (GX1 - GX0);
  line(S, 0, 102, W, 102, cPoly[0], cPoly[1], cPoly[2], 0.35);
  const gv = S.gv;
  let gm = 1e-9;
  for (let i = 0; i <= NS; i++) { gv[i] = homog(S, TH0 + (i / NS) * (TH1 - TH0)); gm = max(gm, abs(gv[i])); }
  S.gmax = S.gmax ? S.gmax + (gm - S.gmax) * 0.2 : gm;
  const g0 = 0.08 * S.gmax, gs = asinh(S.gmax / g0);
  // The area between the curve and zero, faint.
  for (let x = GX0; x <= GX1; x++) {
    const th = TH0 + ((x + 0.5 - GX0) / (GX1 - GX0)) * (TH1 - TH0);
    const v = homog(S, th), y = amp * cl(asinh(v / g0) / gs, -1, 1), k = 0.14 + 0.3 * memAt(S.memS, th);
    const y0 = floor(yc - max(0, y)), y1 = ceil(yc - min(0, y));
    for (let py = y0; py < y1; py++) {
      const o = py * W + x;
      R[o] += cScan[0] * k; G[o] += cScan[1] * k; B[o] += cScan[2] * k;
    }
  }
  line(S, GX0, yc, GX1, yc, cPoly[0], cPoly[1], cPoly[2], 0.6);
  let lx = 0, ly = 0;
  for (let i = 0; i <= NS; i++) {
    const th = TH0 + (i / NS) * (TH1 - TH0), x = gx(th), y = yc - amp * cl(asinh(gv[i] / g0) / gs, -1, 1);
    if (i) line(S, lx, ly, x, y, cScan[0], cScan[1], cScan[2], 0.55 + 0.45 * memAt(S.memS, th));
    lx = x; ly = y;
  }
  for (let i = 0; i < nr; i++) {
    const x = roots[i], th = -atan(x), vis = ease((abs(x) - 0.02) / 0.18);
    const gc = gold(x, 1);
    line(S, gx(th), yc - 4, gx(th), yc + 4, gc[0], gc[1], gc[2], vis * (0.7 + 0.3 * memAt(S.memS, th)));
  }
  line(S, gx(thM), yc + 5, gx(thM), yc + 9, cMiss[0], cMiss[1], cMiss[2], 0.9);
  const cx = gx(S.th);
  line(S, cx, GY0 - 1, cx, GY1 + 1, cScan[0], cScan[1], cScan[2], 0.6);

  // The count of real roots.
  const dg = DIGITS[min(9, nd)];
  for (let i = 0; i < dg.length; i += 2) {
    const o = (GY0 - 1 + dg[i + 1]) * W + GX0 + dg[i];
    R[o] = cGold[0]; G[o] = cGold[1]; B[o] = cGold[2];
  }

  // Over-bright LEDs keep their hue: a sum past 255 is scaled down, not clipped to white.
  for (let q = 0; q < NP; q++) {
    const m = max(R[q], G[q], B[q]), k = m > 255 ? 255 / m : 1;
    display.setPixel(q % W, (q / W) | 0, R[q] * k, G[q] * k, B[q] * k);
  }
}
