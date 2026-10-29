// ===== Patternflow pattern =====
// Title:   Parallel Transport
// Family:  space
// Idea:    A lit globe turns on the upper half and a gold arrow is carried round a loop on it without ever turning, leaving ghost arrows behind and tinting the area its loop has swept, and when the loop closes the arrow stands beside its white starting self turned by exactly that area, which a dial on the lower half has been adding up all the way round.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: parallel transport (Tullio Levi-Civita, 1917), its holonomy as enclosed area by Gauss-Bonnet (Carl Friedrich Gauss, 1827; Pierre Ossian Bonnet, 1848), Foucault's pendulum (Léon Foucault, 1851), pattern round 68
// Round:   68
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Loop=0..3, Size=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together: at 0 the globe is blue, the arrow gold, the swept area rose and the area swept backwards sea green; the globe keeps to the hues from green to violet so it never dims to brown.
// Knob 2: Speed. At 2 the arrow goes round its loop in 6 s, then holds 2.6 s and fades 0.6 s before it starts again; at 0.2 a lap takes 60 s, at 3 it takes 4 s.
// Knob 3: Loop. 0 the triangle from the north pole down a meridian, along the equator and back up another, which turns the arrow by its angle at the pole; 1 a circle of latitude, which turns it by 2 pi (1 - sin latitude), the same as 2 pi sin latitude the other way, the turn of Foucault's pendulum in a sidereal day; 2 a small geodesic square, whose four corners are each a little over 90 degrees and turn it by their excess; 3 two circles touching at a point, the first run counterclockwise and the second clockwise, so their areas cancel.
// Knob 4: Size. The triangle's angle at the pole from 10 to 170 degrees, 90 at the opening 0.06; the latitude from 8 degrees (turn 309.9) to 85 (turn 1.4), 48.85 at 0.06, the Pantheon in Paris, turn 88.9; the square's centre to corner from 2 degrees (turn 0.14) to 30 (turn 32.8), 8 at 0.06, turn 2.2; the two circles 11 and 33 degrees at -1 (turn -51.5), both 22 at 0.06 (turn 0), 33 and 11 at 1 (turn 51.5).

const W = 64, H = 128, TOP = 64;
const { floor, ceil, min, max, abs, sqrt, sin, cos, atan2, acos, asin, exp, log, round, PI } = Math;
const TAU = 2 * PI, DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const fr = (x) => x - floor(x);
const wrap = (a) => a - TAU * round(a / TAU);

function hsv(h, s, v, o) {
  h = fr(h) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Points and tangent vectors are plain [x, y, z] on the unit sphere, z north.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => {
  const l = sqrt(dot(a, a)) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lin = (a, ka, b, kb) => [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
const sph = (lat, lon) => [cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)];

// Parallel transport of a tangent vector v at a along the great circle to b.
// It is the rotation about a x b that takes a to b, so it is exact for any
// step; a loop sampled at 900 points is carried exactly round the geodesic
// polygon through them.
function carry(a, b, v) {
  const d = dot(v, b) / (1 + dot(a, b));
  return [v[0] - d * (a[0] + b[0]), v[1] - d * (a[1] + b[1]), v[2] - d * (a[2] + b[2])];
}
// Signed angle from u to v about the outward normal n, counterclockwise as
// seen from outside the sphere.
const ang = (u, v, n) => atan2(dot(crs(u, v), n), dot(u, v));

// Pieces of a loop: a great arc from a to b, or an arc of the small circle of
// angular radius r about c, from x through the signed angle sweep.
function gArc(a, b) {
  const w = acos(cl(dot(a, b), -1, 1)), s = sin(w);
  return { len: w, at: (t) => lin(a, sin((1 - t) * w) / s, b, sin(t * w) / s) };
}
function cArc(c, r, x, sweep) {
  const e1 = nrm(lin(x, 1, c, -dot(x, c))), e2 = crs(c, e1);
  return { len: abs(sweep) * sin(r), at: (t) => lin(c, cos(r), lin(e1, cos(sweep * t), e2, sin(sweep * t)), sin(r)) };
}

// Size runs -1..1 and opens at 0.06; pivot puts lo, mid, hi at -1, 0.06, 1.
const pivot = (u, lo, mid, hi) => (u < 0.06 ? mid + ((lo - mid) * (0.06 - u)) / 1.06 : mid + ((hi - mid) * (u - 0.06)) / 0.94);

const KS = 900, NB = 720;

// The loop, the arrow carried round it, the gauge it is measured against and
// the area swept so far. The gauge at a point is the start arrow carried
// back to the fan centre c and out again along great circles; the angle from
// the gauge to the carried arrow is then the holonomy of the closed path
// c, start, along the loop, here, c, which is the area of the fan from c over
// the loop so far. At the end the gauge is the start arrow itself.
function build(S, which, u) {
  const N = [0, 0, 1];
  let pieces, c, rb, want;
  if (which === 0) {
    const th = pivot(u, 10, 90, 170) * DEG, A = sph(0, -th / 2), B = sph(0, th / 2);
    pieces = [gArc(N, A), gArc(A, B), gArc(B, N)];
    c = nrm(lin(lin(N, 1, A, 1), 1, B, 1));
    rb = acos(dot(c, A)), want = th;
  } else if (which === 1) {
    const ph = pivot(u, 8, 48.85, 85) * DEG;
    pieces = [cArc(N, PI / 2 - ph, sph(ph, -0.6), TAU)];
    c = N, rb = PI / 2 - ph, want = TAU * (1 - sin(ph));
  } else if (which === 2) {
    const rho = exp(pivot(u, log(2), log(8), log(30))) * DEG, la = 0.35;
    c = sph(la, 0);
    const e1 = [-sin(la), 0, cos(la)], e2 = crs(c, e1);
    const V = (a) => lin(c, cos(rho), lin(e1, cos(a), e2, sin(a)), sin(rho));
    const q = PI / 4, M = nrm(lin(V(3 * q), 1, V(5 * q), 1));
    pieces = [gArc(M, V(5 * q)), gArc(V(5 * q), V(7 * q)), gArc(V(7 * q), V(q)), gArc(V(q), V(3 * q)), gArc(V(3 * q), M)];
    rb = rho, want = 8 * Math.atan(1 / cos(rho)) - TAU;
  } else {
    const d = pivot(u, -0.5, 0, 0.5), r1 = 22 * DEG * (1 + d), r2 = 22 * DEG * (1 - d), P = sph(0.3, 0), E = [0, 1, 0];
    const c1 = lin(P, cos(r1), E, sin(r1)), c2 = lin(P, cos(r2), E, -sin(r2)), F = cArc(c1, r1, P, -PI / 2).at(1);
    // From the top of the first circle a quarter round to P, the second
    // circle clockwise, then the rest of the first.
    pieces = [cArc(c1, r1, F, PI / 2), cArc(c2, r2, P, -TAU), cArc(c1, r1, P, 1.5 * PI)];
    c = P, rb = 2 * max(r1, r2), want = TAU * (cos(r2) - cos(r1));
  }
  let L = 0;
  for (const p of pieces) L += p.len;
  const ns = pieces.map((p) => max(4, round((KS * p.len) / L)));
  const K = ns.reduce((a, b) => a + b, 0);
  const P = new Float64Array(3 * (K + 1)), V = new Float64Array(3 * (K + 1));
  const cum = new Float64Array(K + 1), psi = new Float64Array(K + 1), area = new Float64Array(K + 1);
  let k = 0, prev = pieces[0].at(0);
  P.set(prev, 0);
  pieces.forEach((pc, i) => {
    for (let j = 1; j <= ns[i]; j++) {
      const q = nrm(pc.at(j / ns[i]));
      k++;
      P.set(q, 3 * k);
      cum[k] = cum[k - 1] + acos(cl(dot(prev, q), -1, 1));
      prev = q;
    }
  });
  const pt = (i) => [P[3 * i], P[3 * i + 1], P[3 * i + 2]];
  const p0 = pt(0), t0 = nrm(lin(pt(1), 1, p0, -dot(pt(1), p0)));
  // The arrow starts pointing back over the loop's right side, 135 degrees
  // clockwise from the way it goes, so neither it nor the returned arrow lies
  // along a leg at the openings.
  let v = lin(t0, -Math.SQRT1_2, crs(p0, t0), -Math.SQRT1_2), g = carry(p0, c, v), ps = 0, ar = 0, last = 0;
  V.set(v, 0);
  // Azimuth bins about c remember which sample first swept them, how far
  // from c the loop is there and which way it went.
  const e1 = nrm(abs(c[2]) < 0.9 ? crs([0, 0, 1], c) : crs([1, 0, 0], c)), e2 = crs(c, e1);
  const bk = new Int32Array(NB).fill(-1), br = new Float32Array(NB), bs = new Int8Array(NB);
  const azi = (p) => atan2(dot(p, e2), dot(p, e1));
  for (let i = 0; i < K; i++) {
    const a = pt(i), b = pt(i + 1);
    v = nrm(carry(a, b, v));
    V.set(v, 3 * (i + 1));
    const G = carry(c, b, g), x = ang(G, v, b);
    ps += wrap(x - last), last = x, psi[i + 1] = ps;
    const det = dot(c, crs(a, b));
    ar += 2 * atan2(det, 1 + dot(c, a) + dot(a, b) + dot(b, c));
    area[i + 1] = ar;
    const da = acos(cl(dot(a, c), -1, 1)), db = acos(cl(dot(b, c), -1, 1));
    if (da < 2e-3 || db < 2e-3) continue;
    const za = azi(a), dz = wrap(azi(b) - za), sg = dz >= 0 ? 1 : -1;
    const ia = floor(((za + PI) / TAU) * NB), n = round(abs(dz / TAU) * NB);
    for (let j = 0; j <= n; j++) {
      const bb = (((ia + sg * j) % NB) + NB) % NB;
      if (bk[bb] < 0) (bk[bb] = i), (br[bb] = da + ((db - da) * j) / max(1, n)), (bs[bb] = sg);
    }
  }
  Object.assign(S, { which, u, K, P, V, cum, psi, area, L, c, e1, e2, bk, br, bs, rb, want });
  S.zoomT = max(1, (which === 2 ? 20 : 13) / (30 * sin(min(rb, PI / 2))));
}

export function setup(params) {
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, which: -1, u: 0.06, s: 0, phase: 0, pt: 0, fresh: 1,
    vlat: 0, vlon: 0, zoom: 1, buf: new Float32Array(W * H * 3), col: [0, 0, 0],
  });
  build(S, 0, 0.06);
  return S;
}

function sampleAt(S, s) {
  let lo = 0, hi = S.K;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (S.cum[m] <= s) lo = m;
    else hi = m;
  }
  const f = cl((s - S.cum[lo]) / max(1e-9, S.cum[hi] - S.cum[lo]), 0, 1), P = S.P, V = S.V, a = 3 * lo, b = 3 * hi;
  const p = nrm([P[a] + (P[b] - P[a]) * f, P[a + 1] + (P[b + 1] - P[a + 1]) * f, P[a + 2] + (P[b + 2] - P[a + 2]) * f]);
  let v = [V[a] + (V[b] - V[a]) * f, V[a + 1] + (V[b + 1] - V[a + 1]) * f, V[a + 2] + (V[b + 2] - V[a + 2]) * f];
  v = nrm(lin(v, 1, p, -dot(v, p)));
  return { p, v, k: lo, f, psi: S.psi[lo] + (S.psi[hi] - S.psi[lo]) * f, area: S.area[lo] + (S.area[hi] - S.area[lo]) * f };
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.hue = kv[0] || 0;
  S.speed = cl(kv[1] ?? 2, 0.2, 3);
  const which = cl(round(kv[2] || 0), 0, 3), u = cl(kv[3] ?? 0.06, -1, 1);
  if (which !== S.which || abs(u - S.u) > 0.002) build(S, which, u);
  // A lap takes 12 / Speed seconds; the hold and the fade shorten more gently.
  const slow = sqrt(2 / S.speed);
  if (S.phase === 0) {
    S.s += (S.speed / 12) * d;
    if (S.s >= 1) (S.s = 1), (S.phase = 1), (S.pt = 0);
  } else {
    S.pt += d / slow;
    if (S.pt > 3.2) (S.phase = 0), (S.s = 0);
  }
  // The view looks at a point between the fan centre and the arrow, from
  // above the latitude it is at, north up; small loops are looked at whole
  // and zoomed in until they are 13 LEDs across or more.
  const now = sampleAt(S, S.s * S.L);
  // Near the close it turns to the start point, so the two arrows face us.
  const big = S.rb > 0.6 && S.which !== 3, w = big ? 1.3 + 3.7 * cl((S.s - 0.8) / 0.2, 0, 1) : S.which === 3 ? 0.8 * (1 - S.s) : 0;
  const tv = nrm(lin(S.c, 1, now.p, w));
  const tlat = cl(asin(tv[2]), -1.5, 1.5), tlon = atan2(tv[1], tv[0]) + (0.16 * sin(0.33 * S.t)) / S.zoom;
  if (S.fresh) (S.vlat = tlat), (S.vlon = tlon), (S.zoom = S.zoomT), (S.fresh = 0);
  const e = 1 - exp(-1.8 * d);
  S.vlat += (tlat - S.vlat) * e;
  S.vlon += wrap(tlon - S.vlon) * e;
  S.zoom *= exp(log(S.zoomT / S.zoom) * e);
  S.now = now;
}

// Additive drawing into the float buffer, clipped to the rows lo..hi-1.
function splat(B, x, y, r, g, b, lo, hi) {
  const i = floor(x - 0.5), j = floor(y - 0.5), fx = x - 0.5 - i, fy = y - 0.5 - j;
  for (let q = 0; q < 4; q++) {
    const ii = i + (q & 1), jj = j + (q >> 1);
    if (ii < 0 || ii >= W || jj < lo || jj >= hi) continue;
    const w = (q & 1 ? fx : 1 - fx) * (q >> 1 ? fy : 1 - fy), k = (jj * W + ii) * 3;
    B[k] += r * w, B[k + 1] += g * w, B[k + 2] += b * w;
  }
}
function line(B, x0, y0, x1, y1, r, g, b, lo, hi) {
  const len = sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)), n = max(1, ceil(len / 0.4)), w = max(len, 0.4) / n;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    splat(B, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, r * w, g * w, b * w, lo, hi);
  }
}

// 3x5 glyphs, rows of three bits, 4 the left column.
const FONT = {
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 3, 1, 7], 4: [5, 5, 7, 1, 1],
  5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
  '-': [0, 0, 7, 0, 0], '.': [0, 0, 0, 0, 4], 'o': [2, 5, 2, 0, 0], ' ': [0, 0, 0, 0, 0],
  T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], R: [6, 5, 6, 5, 5], N: [6, 5, 5, 5, 5], A: [2, 5, 7, 5, 5], E: [7, 4, 6, 4, 7], '=': [0, 7, 0, 7, 0],
};
const sc = (v) => (v < 0.85 ? v : 0.85 + 0.15 * (1 - exp(-(v - 0.85) / 0.15)));
const gw = (ch) => (ch === '.' ? 1 : 3);
function text(B, str, cx, y, r, g, b) {
  let wd = -1;
  for (const ch of str) wd += gw(ch) + 1;
  let x = round(cx - wd / 2);
  for (const ch of str) {
    const gl = FONT[ch] || FONT[' '];
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < gw(ch); col++)
        if ((gl[row] >> (gw(ch) === 1 ? 2 : 2 - col)) & 1) {
          const k = ((y + row) * W + x + col) * 3;
          if (x + col >= 0 && x + col < W) (B[k] += r), (B[k + 1] += g), (B[k + 2] += b);
        }
    x += gw(ch) + 1;
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.now) return;
  const B = S.buf, col = S.col, now = S.now, t = S.t;
  B.fill(0);
  const CX = 32, CY = 32, Rz = 30 * S.zoom;
  const f = sph(S.vlat, S.vlon), rt = [-sin(S.vlon), cos(S.vlon), 0];
  const up = [-sin(S.vlat) * cos(S.vlon), -sin(S.vlat) * sin(S.vlon), cos(S.vlat)];
  const proj = (p) => [CX + Rz * dot(p, rt), CY - Rz * dot(p, up), dot(p, f)];
  const fade = S.phase === 1 ? cl((3.2 - S.pt) / 0.6, 0, 1) : 1;
  // Colours.
  const bh = 0.3 + 0.55 * fr(S.hue + 0.52);
  const body = hsv(bh, 0.7, 1, [0, 0, 0]), grid = hsv(bh, 0.3, 1, [0, 0, 0]);
  const gold = hsv(S.hue + 0.13, 0.75, 1, [0, 0, 0]), pos = hsv(S.hue + 0.92, 0.6, 1, [0, 0, 0]), neg = hsv(S.hue + 0.45, 0.7, 1, [0, 0, 0]);
  const pale = hsv(S.hue + 0.13, 0.2, 1, [0, 0, 0]);
  // Graticule spacing: the coarsest of 30, 15, 10, 5, 2.5, 1 degrees that
  // still leaves 9 LEDs between lines.
  let gs = 30;
  for (const g of [1, 2.5, 5, 10, 15, 30])
    if (g * DEG * Rz >= 9) {
      gs = g;
      break;
    }
  const gr = gs * DEG;
  // The globe, lit from the upper left; the swept fan tinted.
  const Lx = -0.45, Ly = 0.5, Lz = 0.74, kNow = S.phase === 0 ? now.k : S.K;
  const { c, e1, e2, bk, br, bs } = S;
  for (let y = 0; y < TOP; y++) {
    const b = (CY - y - 0.5) / Rz;
    for (let x = 0; x < W; x++) {
      const a = (x + 0.5 - CX) / Rz, q = a * a + b * b;
      if (q >= 1) continue;
      const z = sqrt(1 - q), edge = cl((1 - sqrt(q)) * Rz * 1.5, 0, 1);
      const p = [a * rt[0] + b * up[0] + z * f[0], a * rt[1] + b * up[1] + z * f[1], a * rt[2] + b * up[2] + z * f[2]];
      const sh = max(0, a * Lx + b * Ly + z * Lz), lit = 0.08 + 0.42 * sh * sh;
      const lat = asin(cl(p[2], -1, 1)), lon = atan2(p[1], p[0]);
      // Meridians close up toward the poles, so every second, fourth, ...
      // one is dropped where they would come nearer than 9 LEDs.
      const cg = gr * cos(lat) * Rz, mg = gr * (cg >= 9 ? 1 : min(64, 2 ** ceil(Math.log2(9 / max(cg, 0.01)))));
      const dl = abs(lat / gr - round(lat / gr)) * gr * Rz, dm = abs(lon / mg - round(lon / mg)) * mg * cos(lat) * Rz;
      const gl = max(0, 1 - dl / 0.8, 1 - dm / 0.8) * (0.07 + 0.1 * sh);
      let tr = 0, tg = 0, tb = 0;
      const zc = atan2(dot(p, e2), dot(p, e1)), bb = floor(((zc + PI) / TAU) * NB) % NB, kk = bk[bb];
      if (kk >= 0 && kk < kNow) {
        const dd = acos(cl(dot(p, c), -1, 1)), m = cl((br[bb] - dd) * Rz + 0.5, 0, 1) * fade * (0.16 + 0.14 * sh);
        const tc = bs[bb] > 0 ? pos : neg;
        (tr = tc[0] * m), (tg = tc[1] * m), (tb = tc[2] * m);
      }
      const k = (y * W + x) * 3;
      B[k] = (body[0] * lit + grid[0] * gl + tr) * edge;
      B[k + 1] = (body[1] * lit + grid[1] * gl + tg) * edge;
      B[k + 2] = (body[2] * lit + grid[2] * gl + tb) * edge;
    }
  }
  // The loop: bright where the arrow has been, dim ahead of it.
  const P = S.P, V = S.V;
  let q0 = proj([P[0], P[1], P[2]]);
  for (let i = 1; i <= S.K; i++) {
    const q1 = proj([P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
    if (q0[2] > 0 && q1[2] > 0) {
      const w = (i <= kNow ? 0.5 : 0.22) * (0.4 + 0.6 * fade);
      line(B, q0[0], q0[1], q1[0], q1[1], pale[0] * w, pale[1] * w, pale[2] * w, 0, TOP);
    }
    q0 = q1;
  }
  // An arrow: a great-circle shaft 10 LEDs long and a head of two 4 LED barbs.
  const Lr = 0.34 / S.zoom, Lh = 0.42 * Lr;
  const arrow = (p, v, cc, w) => {
    let a = proj(p);
    if (a[2] <= 0) return;
    splat(B, a[0], a[1], cc[0] * w, cc[1] * w, cc[2] * w, 0, TOP);
    for (let i = 1; i <= 5; i++) {
      const s = (Lr * i) / 5, b = proj(lin(p, cos(s), v, sin(s)));
      if (b[2] > 0) line(B, a[0], a[1], b[0], b[1], cc[0] * w, cc[1] * w, cc[2] * w, 0, TOP);
      a = b;
    }
    const tip = lin(p, cos(Lr), v, sin(Lr)), fw = lin(p, -sin(Lr), v, cos(Lr)), sd = crs(tip, fw), ta = proj(tip);
    for (const sg of [-1, 1]) {
      const dv = lin(fw, -cos(0.6), sd, sg * sin(0.6)), e = proj(lin(tip, cos(Lh), dv, sin(Lh)));
      if (e[2] > 0 && ta[2] > 0) line(B, ta[0], ta[1], e[0], e[1], cc[0] * w, cc[1] * w, cc[2] * w, 0, TOP);
    }
  };
  // Ghost arrows every 8 LEDs or so of loop, left as the arrow passes.
  const nG = cl(round((S.L * Rz) / 8), 5, 16), sNow = S.s * S.L;
  for (let j = 1; j < nG; j++) {
    const sj = (j * S.L) / nG;
    if (sj > sNow) break;
    const g = sampleAt(S, sj), w = 0.42 * fade * cl((sNow - sj) * Rz * 0.3, 0, 1);
    arrow(g.p, g.v, gold, w);
  }
  const p0 = [P[0], P[1], P[2]], v0 = [V[0], V[1], V[2]], white = [0.85, 0.9, 1];
  const hold = S.phase === 1 ? fade : 0;
  arrow(p0, v0, white, 0.45 + 0.5 * hold);
  arrow(now.p, now.v, gold, 1.15 * fade);
  // At the close, an arc from the start arrow round to the returned one.
  const turn = now.psi;
  if (hold > 0) {
    const ra = 0.62 * Lr, n0 = crs(p0, v0), n = max(8, ceil(abs(turn) * ra * Rz));
    let a = null;
    const blink = 0.75 + 0.25 * sin(t * 6);
    for (let i = 0; i <= n; i++) {
      const al = (turn * i) / n, dir = lin(v0, cos(al), n0, sin(al)), b = proj(lin(p0, cos(ra), dir, sin(ra)));
      const tc = turn >= 0 ? pos : neg, w = hold * blink;
      if (a && a[2] > 0 && b[2] > 0) line(B, a[0], a[1], b[0], b[1], tc[0] * w, tc[1] * w, tc[2] * w, 0, TOP);
      a = b;
    }
  }
  // The dial: the area swept so far as a pie from twelve o'clock, positive
  // counterclockwise, and the arrow's turn against the gauge as the needle.
  const DX = 32, DY = 94, DR = 25, HUB = 9.5, A = S.phase === 0 ? now.area : S.area[S.K];
  const tc = A >= 0 ? pos : neg;
  for (let y = DY - DR - 2; y <= DY + DR + 2; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - DX, dy = y + 0.5 - DY, r = sqrt(dx * dx + dy * dy);
      if (r > DR + 1.5) continue;
      const k = (y * W + x) * 3, ring = max(0, 1 - abs(r - DR) / 0.8) * 0.2;
      (B[k] += ring * grid[0]), (B[k + 1] += ring * grid[1]), (B[k + 2] += ring * grid[2]);
      if (r >= DR - 0.5 || r <= HUB) continue;
      const al = atan2(-dx, -dy), a1 = A >= 0 ? fr(al / TAU) * TAU : fr(-al / TAU) * TAU;
      const m = cl((abs(A) - a1) * r + 0.5, 0, 1) * cl(r - HUB, 0, 1) * (0.14 + 0.3 * (r / DR)) * (0.5 + 0.5 * fade);
      (B[k] += tc[0] * m), (B[k + 1] += tc[1] * m), (B[k + 2] += tc[2] * m);
    }
  const ray = (al, r0, r1, cc, w) =>
    line(B, DX - sin(al) * r0, DY - cos(al) * r0, DX - sin(al) * r1, DY - cos(al) * r1, cc[0] * w, cc[1] * w, cc[2] * w, TOP, H);
  for (let i = 0; i < 12; i++) ray((i * PI) / 6, i % 3 ? DR - 2.5 : DR - 4, DR - 0.5, grid, i % 3 ? 0.35 : 0.6);
  // Where this loop's turn will end.
  const wt = S.want, wtc = wt >= 0 ? pos : neg;
  ray(wt, DR - 1, DR + 2, wtc, 0.9);
  ray(0, HUB + 1, DR - 2, white, 0.4 + 0.4 * hold);
  const nd = S.phase === 0 ? turn : S.psi[S.K];
  ray(nd, HUB + 1, DR - 2, gold, 1.1);
  const tx = DX - sin(nd) * (DR - 2), ty = DY - cos(nd) * (DR - 2);
  for (const sg of [-1, 1]) {
    const bd = nd + PI + sg * 0.55;
    line(B, tx, ty, tx - sin(bd) * 4.2, ty - cos(bd) * 4.2, gold[0] * 1.1, gold[1] * 1.1, gold[2] * 1.1, TOP, H);
  }
  // The turn in degrees in the hub, one decimal under 10.
  const dg = (nd * 180) / PI;
  let str = abs(dg) < 9.95 ? (abs(dg) < 0.05 ? '0.0' : dg.toFixed(1)) : String(round(dg));
  str += 'o';
  const tw = 0.75 + 0.25 * hold;
  text(B, str, DX, DY - 2, tw, tw, tw);
  text(B, 'TURN=AREA', DX, 122, pale[0] * 0.45, pale[1] * 0.45, pale[2] * 0.45);
  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, floor(sc(B[o]) * 255), floor(sc(B[o + 1]) * 255), floor(sc(B[o + 2]) * 255));
  }
}
