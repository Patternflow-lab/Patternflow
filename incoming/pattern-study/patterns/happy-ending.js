// ===== Patternflow pattern =====
// Title:   Happy Ending
// Family:  particle
// Idea:    Points land on the panel one at a time and after every one the biggest set of them that are all corners of their own convex hull is found exactly and lit as a glowing polygon that flashes each time it gains a corner, while a row of pips at the foot counts its corners, so that a famous set of eight points stops at four but a ninth point anywhere makes five.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the happy ending problem (Esther Klein, 1933; so named by Paul Erdos), Erdos-Szekeres conjecture ES(n) = 2^(n-2) + 1 (Paul Erdos and George Szekeres, 1935), their cup and cap construction of 2^(n-2) points with no convex n-gon (1961), ES(5) = 9 (Kalbfleisch, Kalbfleisch and Stanton, 1970), ES(6) = 17 (Szekeres and Peters, 2006), the largest convex subset by a dynamic programme over its lowest corner (after Chvatal and Klincsek, 1980); pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Extra=-4..7, Glow=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 the polygon runs from teal at the top to blue at the bottom with a pale rim and white corners, the other points are dim blue, and the pips at the foot run from green to violet.
// Knob 2: Speed. How fast the points land. At 2 a new set lands one point every 0.8 s from 0.5 s. The first picture after switching on is the whole story run through at 0.17 s a point and ends in its flash at 1.66 s. 0.5 is four times slower and 4 is twice as fast.
// Knob 3: Extra. How many points go down before the picture resets, nine plus this number, from 5 at -4 to 16 at 7. At 0 there are nine, the number that always makes a convex pentagon. At -1 there are eight, and every other picture is a set of eight with no convex pentagon in it, so the size stops at four.
// Knob 4: Glow. How soft the light is. At -1 the polygon is a crisp shape with a thin line round it; at 1 its edge is feathered over 13 LEDs, the rim is broad and a halo spills out of it. It opens a little above the middle.

const W = 64, H = 128, NP = 16; // up to sixteen points
const FX0 = 3, FX1 = 60, FY0 = 3, FY1 = 108; // the field the points fall in; the pips stand below it
const { floor, round, min, max, abs, sqrt, exp, atan2, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A seeded generator, so the same picture comes back from the same cycle number.
function rng(seed) {
  let a = (seed | 0) ^ 0x5bd1e995;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The maths. The largest set of points that are all corners of their own
// convex hull, found exactly. Fix the lowest corner p of the polygon. Every
// other corner is above it, and going round the polygon they come in order of
// their angle at p, so the polygon is a chain p, v1, v2, ... of points in
// that order in which every consecutive three turn the same way. The turns at
// p, at v1 and at the last corner are settled by the angle order alone, so
// only the turn at each middle corner is tested. Let f(i, j) be the best chain
// whose last two corners are v_i and v_j; then f(i, j) is f(k, i) plus one for
// the best k before i with a left turn at v_i, which is O(m^3) for the m
// points above p and O(n^4) for every p. With n at most 16 it is about 3,000
// steps. Chains are scored by corner count first and area second (the fan of
// triangles from p), so of the polygons of the top size the biggest one wins.
// ---------------------------------------------------------------------------
const BIG = 100000;
const F = new Float64Array(32 * 32), PAR = new Int16Array(32 * 32), ORD = new Int16Array(32), ANG = new Float64Array(32);
let EI = 0, EJ = 0;

function chainFrom(X, Y, n, p) {
  let m = 0;
  for (let q = 0; q < n; q++) {
    if (q === p) continue;
    const dy = Y[q] - Y[p];
    if (dy > 0 || (dy === 0 && X[q] > X[p])) {
      ORD[m++] = q;
      ANG[q] = atan2(dy, X[q] - X[p]);
    }
  }
  if (m < 2) return -1;
  for (let a = 1; a < m; a++) {
    const v = ORD[a];
    let b = a - 1;
    while (b >= 0 && ANG[ORD[b]] > ANG[v]) {
      ORD[b + 1] = ORD[b];
      b--;
    }
    ORD[b + 1] = v;
  }
  let best = -1;
  for (let j = 1; j < m; j++) {
    const vj = ORD[j];
    for (let i = 0; i < j; i++) {
      const vi = ORD[i];
      const tri = 0.5 * ((X[vi] - X[p]) * (Y[vj] - Y[p]) - (Y[vi] - Y[p]) * (X[vj] - X[p]));
      let sc = 3 * BIG + tri, par = -1;
      for (let k = 0; k < i; k++) {
        const vk = ORD[k];
        if ((X[vi] - X[vk]) * (Y[vj] - Y[vk]) - (Y[vi] - Y[vk]) * (X[vj] - X[vk]) > 0) {
          const c = F[k * 32 + i] + BIG + tri;
          if (c > sc) {
            sc = c;
            par = k;
          }
        }
      }
      F[i * 32 + j] = sc;
      PAR[i * 32 + j] = par;
      if (sc > best) {
        best = sc;
        EI = i;
        EJ = j;
      }
    }
  }
  return best;
}

// Writes the corners of the biggest convex polygon among the first n points
// into poly, counterclockwise from the lowest, and returns how many.
function largestConvex(X, Y, n, poly) {
  if (n < 3) {
    for (let i = 0; i < n; i++) poly[i] = i;
    return n;
  }
  let best = -1, bp = 0;
  for (let p = 0; p < n; p++) {
    const s = chainFrom(X, Y, n, p);
    if (s > best) {
      best = s;
      bp = p;
    }
  }
  chainFrom(X, Y, n, bp);
  const cnt = floor(best / BIG);
  let i = EI, j = EJ, w = cnt - 2;
  poly[0] = bp;
  poly[cnt - 1] = ORD[j];
  for (;;) {
    poly[w--] = ORD[i];
    const k = PAR[i * 32 + j];
    if (k < 0) break;
    j = i;
    i = k;
  }
  return cnt;
}

// ---------------------------------------------------------------------------
// The sets. Eight points with no five in convex position, after the cup and
// cap recipe of Erdos and Szekeres for n = 5: a point, a group of three that
// bends one way, a group of three that bends the other way and a point, in
// that order along an arc that gets steeper, the groups flat against it. The
// first set of that shape was checked by brute force over all 56 five-point
// subsets, then pulled apart to fill the panel by a hill climb that kept the
// count of convex pentagons at zero. There are three, which are one order type
// (the same orientation of every triple, up to naming the points and a mirror).
// ---------------------------------------------------------------------------
const FAMOUS = [
  [[60, 3], [41.6, 16.9], [27.4, 17.1], [3, 3.1], [43.9, 91.5], [28.7, 89], [3, 107.9], [60, 107.9]],
  [[59.9, 3.1], [37.3, 16.9], [3.1, 3], [19.5, 17], [19.7, 89.5], [36.5, 89.3], [3, 107.9], [60, 107.7]],
  [[3, 3], [23.7, 26.2], [37, 29.6], [60, 3.2], [27.6, 86.6], [43.7, 89], [59.9, 108], [3, 107.9]],
];
const NINTH0 = [57, 80]; // the ninth point of the first picture: any point makes a pentagon, this one the biggest

// A new random point: the first of up to 60 uniform tries that is 7 LEDs from
// every other point and 1.2 LEDs from every line through two of them, so that
// no three points sit on a line the eye could take for straight. If none does,
// the best of the tries. That is the only thing that is not plain uniform.
function newPoint(X, Y, n, r) {
  let bx = 0, by = 0, bs = -1;
  for (let t = 0; t < 60; t++) {
    const x = FX0 + r() * (FX1 - FX0), y = FY0 + r() * (FY1 - FY0);
    let sc = 7;
    for (let a = 0; a < n && sc > 0; a++) {
      const dx = x - X[a], dy = y - Y[a];
      sc = min(sc, sqrt(dx * dx + dy * dy));
    }
    sc /= 7;
    for (let a = 0; a < n && sc > 0.05; a++)
      for (let b = a + 1; b < n; b++) {
        const ar2 = abs((X[b] - X[a]) * (y - Y[a]) - (Y[b] - Y[a]) * (x - X[a]));
        const l = max(sqrt((X[b] - X[a]) ** 2 + (Y[b] - Y[a]) ** 2), sqrt((x - X[a]) ** 2 + (y - Y[a]) ** 2), sqrt((x - X[b]) ** 2 + (y - Y[b]) ** 2));
        sc = min(sc, ar2 / l / 1.2);
      }
    if (sc > bs) {
      bs = sc;
      bx = x;
      by = y;
      if (sc >= 1) break;
    }
  }
  X[n] = bx;
  Y[n] = by;
}

// ---------------------------------------------------------------------------
// Timing. The clock tau runs at Speed / 2 of a second. A set lands one point
// every DT from T0; the first picture runs the whole story at DT0 instead.
// ---------------------------------------------------------------------------
const T0 = 0.5, DT = 0.8, T0I = 0.3, DT0 = 0.17, HOLD = 2.4, FADE = 0.9, REST = 0.3;
const XFADE = 0.4; // the time one polygon takes to give way to the next
const FLASH = [0, 0, 0, 0.62, 0.78, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, extra: 0, glow: 0, tau: 0, cycle: 0, n: 9,
    X: new Float64Array(NP), Y: new Float64Array(NP),
    sz: new Int8Array(NP + 1), pn: new Int8Array(NP + 1), pv: new Int8Array((NP + 1) * NP), ev: new Float32Array(NP + 1), gd: new Uint8Array(NP + 1),
    reach: new Int8Array(NP + 2), acc: new Float32Array(W * H * 3), poly: new Int16Array(32), t0: T0, dt: DT,
  };
  start(params.s);
}

// A new picture: its points, the polygon after each of them and when it grows.
function start(S) {
  const c = S.cycle, r = rng(c * 7919 + 17), X = S.X, Y = S.Y;
  const famous = c % 2 === 0;
  S.t0 = c === 0 ? T0I : T0;
  S.dt = c === 0 ? DT0 : DT;
  let n = 0;
  if (famous) {
    const v = c === 0 ? 0 : floor(r() * 3), fx = c > 0 && r() < 0.5, fy = c > 0 && r() < 0.5;
    // an order for the eight in which the first four are already a convex quadrilateral
    let ord = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let tries = 0; tries < 60; tries++) {
      for (let i = 7; i > 0; i--) {
        const j = floor(r() * (i + 1)), t = ord[i];
        ord[i] = ord[j];
        ord[j] = t;
      }
      for (let i = 0; i < 4; i++) {
        X[i] = FAMOUS[v][ord[i]][0];
        Y[i] = FAMOUS[v][ord[i]][1];
      }
      if (largestConvex(X, Y, 4, S.poly) === 4) break;
    }
    for (let i = 0; i < 8; i++) {
      const p = FAMOUS[v][ord[i]];
      X[i] = fx ? FX0 + FX1 - p[0] : p[0];
      Y[i] = fy ? FY0 + FY1 - p[1] : p[1];
    }
    n = 8;
    if (c === 0) {
      X[8] = NINTH0[0];
      Y[8] = NINTH0[1];
      n = 9;
    }
  }
  while (n < NP) {
    newPoint(X, Y, n, r);
    n++;
  }
  // the polygon after k points, its corners, whether it is a new size or only a
  // new shape, and when each size is first reached
  const poly = S.poly;
  S.sz.fill(0);
  S.pn.fill(0);
  S.ev.fill(0);
  S.gd.fill(0);
  S.reach.fill(0);
  for (let k = 1; k <= NP; k++) {
    const m = k < 3 ? k : largestConvex(X, Y, k, poly);
    S.sz[k] = m;
    if (k >= 3) {
      S.pn[k] = m;
      for (let i = 0; i < m; i++) S.pv[k * NP + i] = poly[i];
      if (m > S.sz[k - 1]) {
        S.ev[k] = FLASH[m];
        // the sizes the theorems force: four corners by the fifth point, five by the ninth
        if ((m === 4 && k === 5) || (m === 5 && k === 9)) S.gd[k] = 1;
      } else if (k > 3 && !sameSet(S, k, k - 1)) S.ev[k] = 0.3;
    }
    for (let s = S.sz[k - 1] + 1; s <= m; s++) S.reach[s] = k;
  }
  S.tau = 0;
  S.n = 9;
}

function sameSet(S, a, b) {
  if (S.pn[a] !== S.pn[b]) return false;
  for (let i = 0; i < S.pn[a]; i++) {
    let found = false;
    for (let j = 0; j < S.pn[b]; j++) if (S.pv[a * NP + i] === S.pv[b * NP + j]) found = true;
    if (!found) return false;
  }
  return true;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.extra = cl(round(k[2]), -4, 7);
  S.glow = cl((cl(k[3], -1, 1) + 1) / 2, 0, 1);
  S.n = 9 + S.extra;
  S.tau += d * (S.speed / 2);
  if (S.tau > S.t0 + (S.n - 1) * S.dt + HOLD + FADE + REST) {
    S.cycle++;
    start(S);
    S.n = 9 + S.extra;
  }
}

const C1 = [0, 0, 0], CORNER = new Uint8Array(NP);

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const tau = S.tau, N = S.n, acc = S.acc, X = S.X, Y = S.Y, sf = S.glow;
  acc.fill(0);
  const tEnd = S.t0 + (N - 1) * S.dt + HOLD, gm = 1 - sm((tau - tEnd) / FADE);
  const k = tau < S.t0 ? 0 : min(N, floor((tau - S.t0) / S.dt) + 1);
  const tk = (j) => S.t0 + (j - 1) * S.dt;
  const base = S.hue + 0.58;

  // the flash: the strongest of the events so far, each rising in 0.1 s,
  // holding 0.5 s and falling away over a second and a half. The gold one
  // is a flash the theorems force.
  let fl = 0, gl = 0;
  for (let j = 3; j <= k; j++) {
    if (S.ev[j] <= 0) continue;
    const a = tau - tk(j), env = a < 0 ? 0 : min(1, a / 0.1) * (a < 0.5 ? 1 : exp(-(a - 0.5) / 0.7));
    fl = max(fl, S.ev[j] * env);
    if (S.gd[j]) gl = max(gl, a < 0 ? 0 : min(1, a / 0.1) * (a < 0.1 ? 1 : exp(-(a - 0.1) / 0.45)));
  }
  const L = { feather: 3 + 10 * sf, haloR: 2.2 + 4 * sf, haloA: 0.2 + 0.3 * sf, rimS: 0.6 + 2 * sf, rimP: 0.95 - 0.5 * sf, base, gl };

  const add = (x, y, r, gg, b, w) => {
    const o = (y * W + x) * 3;
    acc[o] += r * w;
    acc[o + 1] += gg * w;
    acc[o + 2] += b * w;
  };

  // The polygon after k points, and the one before it while it gives way.
  if (k >= 3) {
    const xf = sm((tau - tk(k)) / XFADE);
    if (xf < 1 && k > 3) polygon(S, k - 1, (1 - xf) * gm, fl, L, add);
    polygon(S, k, (k > 3 ? xf : 1) * gm, fl, L, add);
  }

  // The points: dim, with the corners of the polygon white. A new one lands
  // with a ring that spreads and fades.
  const cur = S.pn[k];
  CORNER.fill(0);
  for (let i = 0; i < cur; i++) CORNER[S.pv[k * NP + i]] = 1;
  for (let j = 1; j <= k; j++) {
    const a = tau - tk(j), x = X[j - 1], y = Y[j - 1], cn = CORNER[j - 1];
    hsv(base + 0.02, cn ? 0.1 : 0.55, 1, C1);
    if (cn && gl > 0) {
      C1[1] -= 0.12 * gl;
      C1[2] -= 0.5 * gl;
    }
    const pk = (cn ? 1 : 0.55) * gm, sg = 1.5 + (a < 0.3 ? 1.5 * (1 - a / 0.3) : 0);
    for (let yy = max(0, floor(y - 8)); yy <= min(H - 1, floor(y + 8)); yy++)
      for (let xx = max(0, floor(x - 8)); xx <= min(W - 1, floor(x + 8)); xx++) {
        const dx = xx - x, dy = yy - y, d2 = dx * dx + dy * dy;
        let b = pk * exp(-d2 / (2 * sg * sg));
        if (a < 0.7) b += (1 - a / 0.7) ** 2 * 0.45 * exp(-((sqrt(d2) - (2 + a * 14)) ** 2) / 4) * gm;
        if (b > 0.004) add(xx, yy, C1[0], C1[1], C1[2], min(1, b));
      }
  }

  // The foot: twelve pips, one for each corner of the polygon, each lit when
  // the polygon first has that many and flashing as it comes on, in gold when
  // a theorem forced it.
  const sz = min(S.sz[k], 12);
  for (let s = 1; s <= 12; s++) {
    const cx = 3.5 + (s - 1) * 5.2, cy = 121, lit = s <= sz;
    const a = lit && S.reach[s] > 0 ? tau - tk(S.reach[s]) : 9, gd = S.reach[s] > 0 && S.gd[S.reach[s]];
    const fz = a < 0.6 ? (1 - a / 0.6) ** 2 : 0;
    hsv(base + 0.035 * (s - 3) - 0.1, 0.85, 1, C1);
    const fr = 1, fg = gd ? 0.88 : 1, fb = gd ? 0.5 : 1;
    for (let yy = 112; yy <= 127; yy++)
      for (let xx = floor(cx - 5); xx <= cx + 5; xx++) {
        const dx = xx - cx, dy = yy - cy, d2 = dx * dx / 2.4 + dy * dy / 11;
        const v = (lit ? 0.85 : 0.2) * exp(-d2);
        const wv = fz * 0.7 * exp(-d2 * 0.6);
        if (v + wv > 0.004) add(xx, yy, C1[0] * v + wv * fr, C1[1] * v + wv * fg, C1[2] * v + wv * fb, gm);
      }
  }

  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, min(255, acc[o] * 255), min(255, acc[o + 1] * 255), min(255, acc[o + 2] * 255));
  }
}

// One polygon lit by its signed distance sd to the boundary, positive inside:
// a fill that fades in across the feather and is brighter toward the middle,
// a thin pale rim on the boundary and a halo outside. The colour runs down the
// height of the polygon.
const VX = new Float64Array(20), VY = new Float64Array(20), EXL = new Float64Array(20), EYL = new Float64Array(20), IL = new Float64Array(20);
const ROWC = new Float32Array(H * 3);
function polygon(S, k, w, fl, L, add) {
  const { feather, haloR, haloA, rimS, rimP, base, gl } = L;
  if (w <= 0.003) return;
  const m = S.pn[k];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, cx = 0, cy = 0;
  for (let i = 0; i < m; i++) {
    const p = S.pv[k * NP + i];
    VX[i] = S.X[p];
    VY[i] = S.Y[p];
    x0 = min(x0, VX[i]);
    x1 = max(x1, VX[i]);
    y0 = min(y0, VY[i]);
    y1 = max(y1, VY[i]);
    cx += VX[i] / m;
    cy += VY[i] / m;
  }
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m;
    EXL[i] = VX[j] - VX[i];
    EYL[i] = VY[j] - VY[i];
    IL[i] = 1 / sqrt(EXL[i] * EXL[i] + EYL[i] * EYL[i]);
  }
  // the inradius estimate: the distance from the middle to its nearest edge
  let rin = 1e9;
  for (let i = 0; i < m; i++) rin = min(rin, (EXL[i] * (cy - VY[i]) - EYL[i] * (cx - VX[i])) * IL[i]);
  rin = max(rin, 4);
  const margin = 16, ya = max(0, floor(y0 - margin)), yb = min(H - 1, floor(y1 + margin)), xa = max(0, floor(x0 - margin)), xb = min(W - 1, floor(x1 + margin));
  const hh = max(y1 - y0, 10), rest = 0.16, amp = rest + (1 - rest) * fl, rimA = 0.5 + 0.5 * fl;
  const c = [0, 0, 0];
  for (let y = ya; y <= yb; y++) {
    hsv(base + 0.2 * ((y - cy) / hh), 0.85, 1, c);
    ROWC[y * 3] = c[0];
    ROWC[y * 3 + 1] = c[1];
    ROWC[y * 3 + 2] = c[2];
  }
  for (let y = ya; y <= yb; y++) {
    const r0 = ROWC[y * 3], g0 = ROWC[y * 3 + 1], b0 = ROWC[y * 3 + 2];
    for (let x = xa; x <= xb; x++) {
      let inside = true, dm = 1e9;
      for (let i = 0; i < m; i++) {
        const ex = EXL[i], ey = EYL[i], ax = VX[i], ay = VY[i], il = IL[i];
        const px = x - ax, py = y - ay;
        if (ex * py - ey * px < 0) inside = false;
        const t = cl((px * ex + py * ey) * il * il, 0, 1), dx = px - t * ex, dy = py - t * ey, d2 = dx * dx + dy * dy;
        if (d2 < dm) dm = d2;
      }
      const sd = inside ? sqrt(dm) : -sqrt(dm);
      if (sd < -16) continue;
      const u = cl(sd / rin, 0, 1);
      const fill = sm((sd + 1) / feather) * (0.55 + 0.45 * pow(u, 0.6));
      const rim = rimP * exp(-(sd * sd) / (2 * rimS * rimS));
      const halo = sd < 0 ? exp(sd / haloR) : 0;
      const bf = amp * fill + haloA * (0.3 + 0.7 * fl) * halo;
      const wh = cl(0.5 * fl * u * u, 0, 0.6);
      const br = min(1, bf), rr = (r0 + (1 - r0) * wh) * br + rimA * rim * 0.9, gg = (g0 + (1 - g0 * 0.0) * wh * (1 - 0.2 * gl)) * br + rimA * rim * 0.9 * (1 - 0.12 * gl), bb = (b0 + (1 - b0) * wh * (1 - 0.65 * gl)) * br + rimA * rim * 0.95 * (1 - 0.5 * gl);
      if (rr > 0.004 || gg > 0.004 || bb > 0.004) add(x, y, rr, gg, bb, w);
    }
  }
}
