// ===== Patternflow pattern =====
// Title:   Central Places
// Family:  centralplace
// Idea:    Christaller's hierarchy of market towns on a plain, four nested nets of hexagonal market areas of villages, towns, cities and a metropolis, whose nets swing from the marketing principle (k = 3) through the transport principle (k = 4) to the administrative principle (k = 7), so that the coarse nets slide across the fine ones and towns win or lose a rank wherever the two come into step.
// Author:  patternflow-lab
// Date:    2026-11-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: central place theory (Walter Christaller, Die zentralen Orte in Suddeutschland, 1933, from memory), the rotated nets that share centres (August Losch, 1940, from memory), Voronoi cells as market areas (Georgy Voronoi, 1908), the exact distance to a hexagonal cell edge computed here, original code, pattern round 276
// Round:   276
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Spacing=0..4, Principle=-1..1, Tilt=0..1
//
// Knob 1: Hue. Turns every line, dot and tint round the colour wheel together. At 0 the villages are teal, the towns coral, the cities gold and the metropolis cream, on a deep indigo ground that does not move.
// Knob 2: Spacing. The distance between neighbouring villages, a = 6 + 2 K LEDs: 6 at 0, 10 at 2 where it opens, 14 at 4. The towns are a sqrt(k) apart, the cities a k, the metropolis a k sqrt(k), so at 6 the whole hierarchy is crowded and the village net has faded out, at 14 the cities are the size of the panel.
// Knob 3: Principle. Where on the way from k = 3 through 4 to 7 the hierarchy sits: k = 4 + K below 0 and 4 + 3 K above, so 3 at -1, 4 at 0 where it opens, 7 at 1. Round that the hierarchy keeps swinging on its own by up to 0.85 of a unit either way, on clocks of 131 and 79 s.
// Knob 4: Tilt. How far the nets are let off the ideal. At 0 every net is turned and sized exactly as its principle says and the villages only wander 2 degrees against the rest. At 1 each net is turned up to 33 degrees more, its centre sits up to 0.28 of its own spacing off the others, the villages twist by 5.5 degrees and the whole plain bends by 5 LEDs.
//
// What the picture is. A plain with villages on a triangular net of spacing a. A town is a centre of the next net, a sublattice of the villages of index k: its basis is a sqrt(k) long and turned from the net below by 30 degrees for k = 3, 0 for k = 4 and 19.1 degrees for k = 7, which is exactly where every centre of a coarse net lands on a village. Between those k the scale is sqrt(k) and the turn runs smoothly between the three, so the nets are real lattices that do not line up and the moire of the nested nets sweeps across the panel. Four such nets are drawn, each one a sqrt(k) coarser and turned further than the one below.
// The lines. Every LED finds the nearest centre of each net and its distance to the edge of that centre's hexagon exactly: s / 2 minus the largest of three projections on the lattice directions. A line is a soft band at that distance, 1.8 LEDs wide for villages, 2.5 for towns, 3.4 for cities and 4.4 for the metropolis, dimmer the finer the net, so rank reads as weight. The village net fades out as its spacing falls from 7 to 5 LEDs, since a cell below that is only a tangle.
// The towns. A dot sits on every centre, sized by rank, and each pulses on its own clock, slower the higher the rank. Wherever a finer centre lies within 0.13 of its own spacing of a coarser one (it lets go at 0.23) it is absorbed into it and only the higher rank is drawn; that moment, in either direction, is a promotion or a demotion, and a ring in the colour of the higher rank grows out from the place or draws in to it. A faint tint fills every city cell and every metropolis cell, and a slow wave of prosperity brightens the tints and the dots as it crosses.
// The drift. The whole map turns by 0.5 degree a second with two swings on top, the nets breathe by about 4 percent, the centre wanders over the panel and the village net twists against the rest. Periods run from 23 to 227 s, none a multiple of another, and nothing is stored but the ranks, so the map does not come round again.

const W = 64, H = 128, NL = 4, STR = 18;
const { floor, ceil, sqrt, exp, sin, cos, min, max, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// style by rank: half width of a line at half height, line weight, dot size, pulse period
const HW = [0.9, 1.1, 1.4, 1.75];
const AL = [0.38, 0.55, 0.72, 0.85];
const CAS = [0, 0.35, 0.5, 0.6];
const DA = [0.6, 0.8, 0.9, 0.9];
const SG = [1.0, 1.4, 1.95, 2.7];
const PT = [2.9, 4.6, 7.3, 11.9];
// hue, saturation, value of each rank
const RK = [[0.49, 0.62, 0.74], [0.025, 0.55, 0.96], [0.11, 0.85, 0.98], [0.13, 0.26, 0.95]];

const OFS = 48, SZ = 96;
const IN = 0.13, OUT = 0.23;   // alignment, in units of the spacing of the finer net

function hash(n, i, j, seed) {
  let h = (Math.imul(i + 1000, 374761393) + Math.imul(j + 1000, 668265263) + Math.imul(n + 7, 1442695041) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function setup(params) {
  const st = [];
  for (let m = 0; m < NL - 1; m++)
    st.push({ rank: new Int8Array(SZ * SZ), ab: new Float32Array(SZ * SZ), cool: new Float32Array(SZ * SZ).fill(-99), seen: new Float32Array(SZ * SZ).fill(-99) });
  params.s = {
    t: 0, k: null, seed: floor(Math.random() * 1e9), L: new Float64Array(NL * STR), st, rings: [],
    WX: new Float32Array(H), GX: new Float32Array(H), WY: new Float32Array(W), GY: new Float32Array(W), FW: new Float32Array(W * H),
    a: 10, keff: 4, tilt: 0.06, aw: 0, hue: 0, bnd: [0, 0, 0, 0], cc: [], cd: [], cg: [],
  };
}

// the angle between one net and the one above it, radians, for k from 3 to 7
function turnOf(k) {
  if (k <= 4) return (30 * (1 - sm(0, 1, k - 3)) * PI) / 180;
  return (-19.1066 * sm(0, 1, (k - 4) / 3) * PI) / 180;
}

// the hierarchy at time t under the knobs: the four nets, the bend of the plain
function configure(S) {
  const t = S.t, kn = S.k;
  const hue = kn[0], a = 8 + 2 * cl(kn[1], 0, 4), tilt = cl(kn[3], 0, 1);
  const kb = kn[2] < 0 ? 4 + cl(kn[2], -1, 0) : 4 + 3 * cl(kn[2], 0, 1);
  let x = kb + 0.85 * (0.62 * sin((TAU * t) / 131 + 1.3) + 0.38 * sin((TAU * t) / 79 + 4.1)) - 3;
  x -= 8 * floor(x / 8);
  const keff = 3 + (x > 4 ? 8 - x : x);
  S.a = a; S.keff = keff; S.tilt = tilt; S.hue = hue;
  const sq = sqrt(keff), th = turnOf(keff);
  const zoom = 1 + 0.035 * sin((TAU * t) / 37 + 1) + 0.02 * sin((TAU * t) / 23 + 3);
  const phi = 0.2 + 0.0085 * t + 0.1 * sin((TAU * t) / 113 + 2) + 0.06 * sin((TAU * t) / 71 + 0.5);
  const cx = 32 + 14 * sin((TAU * t) / 151 + 0.4) + 4 * sin((TAU * t) / 61 + 2.6);
  const cy = 64 + 30 * sin((TAU * t) / 227 + 5.1) + 8 * sin((TAU * t) / 89 + 1.1);
  const eps = (0.035 + 0.06 * tilt) * (0.6 * sin((TAU * t) / 97 + 0.7) + 0.4 * sin((TAU * t) / 59 + 2.2));
  const tr = tilt * 0.34 * (1 + 0.4 * sin((TAU * t) / 157 + 0.9));
  const MU = [0, 1, -1.3, 1.7];
  const L = S.L;
  let sp = a * zoom;
  for (let n = 0; n < NL; n++) {
    const o = n * STR;
    const ang = n === 0 ? phi + eps : phi + n * th + MU[n] * tr;
    const ox = n === 0 ? cx : cx + tilt * 0.28 * sp * cos(1.7 * n + 0.021 * (n + 1) * t);
    const oy = n === 0 ? cy : cy + tilt * 0.28 * sp * sin(1.7 * n + 0.021 * (n + 1) * t);
    const c0 = cos(ang), s0 = sin(ang), c1 = cos(ang + PI / 3), s1 = sin(ang + PI / 3), c2 = cos(ang + (2 * PI) / 3), s2 = sin(ang + (2 * PI) / 3);
    const b1x = sp * c0, b1y = sp * s0, b2x = sp * c1, b2y = sp * s1, det = b1x * b2y - b1y * b2x;
    L[o] = ox; L[o + 1] = oy;
    L[o + 2] = b2y / det; L[o + 3] = -b2x / det; L[o + 4] = -b1y / det; L[o + 5] = b1x / det;
    L[o + 6] = b1x; L[o + 7] = b1y; L[o + 8] = b2x; L[o + 9] = b2y;
    L[o + 10] = sp;
    L[o + 11] = c0; L[o + 12] = s0; L[o + 13] = c1; L[o + 14] = s1; L[o + 15] = c2; L[o + 16] = s2;
    sp *= sq;
  }
  // the bend of the plain: a smooth displacement, x by row and y by column
  const aw = 0.15 + 5 * tilt * tilt;
  S.aw = aw;
  const k1 = TAU / 137, k2 = TAU / 61, k3 = TAU / 97, k4 = TAU / 47;
  for (let y = 0; y < H; y++) {
    const p1 = k1 * y + 0.8 + 0.037 * t, p2 = k2 * y + 2.1 - 0.05 * t;
    S.WX[y] = (aw / 1.5) * (sin(p1) + 0.5 * sin(p2));
    S.GX[y] = (aw / 1.5) * (k1 * cos(p1) + 0.5 * k2 * cos(p2));
  }
  for (let xx = 0; xx < W; xx++) {
    const p1 = k3 * xx + 3.3 + 0.031 * t, p2 = k4 * xx + 4.4 + 0.04 * t;
    S.WY[xx] = (aw / 1.5) * (sin(p1) + 0.5 * sin(p2));
    S.GY[xx] = (aw / 1.5) * (k3 * cos(p1) + 0.5 * k4 * cos(p2));
  }
  // colours
  for (let n = 0; n < NL; n++) {
    const c = S.cc[n] || (S.cc[n] = [0, 0, 0]);
    hsv(RK[n][0] + hue, RK[n][1], RK[n][2], c);
  }
}

// screen position of a point of the bent plain: x + wx(y) = px, y + wy(x) = py
function unbend(S, px, py, out) {
  const t = S.t, aw = S.aw;
  let qx = px, qy = py;
  for (let it = 0; it < 3; it++) {
    qx = px - (aw / 1.5) * (sin((TAU / 137) * qy + 0.8 + 0.037 * t) + 0.5 * sin((TAU / 61) * qy + 2.1 - 0.05 * t));
    qy = py - (aw / 1.5) * (sin((TAU / 97) * qx + 3.3 + 0.031 * t) + 0.5 * sin((TAU / 47) * qx + 4.4 + 0.04 * t));
  }
  out[0] = qx; out[1] = qy;
}

// the range of lattice indices of net m whose points can lie within mg of the panel
function bounds(S, m, mg) {
  const L = S.L, o = m * STR, B = S.bnd;
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let c = 0; c < 4; c++) {
    const dx = (c & 1 ? W + mg : -mg) - L[o], dy = (c & 2 ? H + mg : -mg) - L[o + 1];
    const u = L[o + 2] * dx + L[o + 3] * dy, v = L[o + 4] * dx + L[o + 5] * dy;
    if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
  }
  B[0] = floor(u0) - 1; B[1] = ceil(u1) + 1; B[2] = floor(v0) - 1; B[3] = ceil(v1) + 1;
}

// distance from a point to the nearest centre of net n
function nearDist(L, n, px, py) {
  const o = n * STR, dx = px - L[o], dy = py - L[o + 1];
  const i0 = floor(L[o + 2] * dx + L[o + 3] * dy), j0 = floor(L[o + 4] * dx + L[o + 5] * dy);
  let best = 1e18;
  for (let di = 0; di < 2; di++)
    for (let dj = 0; dj < 2; dj++) {
      const ex = px - (L[o] + (i0 + di) * L[o + 6] + (j0 + dj) * L[o + 8]), ey = py - (L[o + 1] + (i0 + di) * L[o + 7] + (j0 + dj) * L[o + 9]);
      const d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
  return sqrt(best);
}

const XY = [0, 0];

// the ranks: a point of a net that comes within reach of a centre of a coarser net is absorbed into it
function ranks(S, d, quiet) {
  const L = S.L, t = S.t;
  for (let m = 0; m < NL - 1; m++) {
    const st = S.st[m], o = m * STR, sp = L[o + 10];
    const tin = IN * sp, tout = OUT * sp;
    bounds(S, m, 12);
    const B = S.bnd, b0 = B[0], b1 = B[1], c0 = B[2], c1 = B[3];
    const al = 1 - exp(-d / 0.5);
    for (let i = b0; i <= b1; i++)
      for (let j = c0; j <= c1; j++) {
        const px = L[o] + i * L[o + 6] + j * L[o + 8], py = L[o + 1] + i * L[o + 7] + j * L[o + 9];
        if (px < -12 || px > W + 12 || py < -12 || py > H + 12) continue;
        const ii = i + OFS, jj = j + OFS;
        if (ii < 0 || jj < 0 || ii >= SZ || jj >= SZ) continue;
        const idx = ii * SZ + jj;
        const old = st.rank[idx];
        let r = 0;
        for (let n = m + 1; n < NL; n++) if (nearDist(L, n, px, py) < (old === n ? tout : tin)) r = n;
        const fresh = t - st.seen[idx] > 0.5;
        st.seen[idx] = t;
        if (fresh) {
          st.rank[idx] = r;
          st.ab[idx] = r > 0 ? 1 : 0;
          continue;
        }
        if (r !== old) {
          st.rank[idx] = r;
          if (!quiet && t - st.cool[idx] > 7 && S.rings.length < 40) {
            unbend(S, px, py, XY);
            if (XY[0] > -6 && XY[0] < W + 6 && XY[1] > -6 && XY[1] < H + 6) {
              const up = r > old, lev = up ? r : old;
              S.rings.push({ x: XY[0], y: XY[1], age: 0, dur: up ? 1.7 : 1.5, up, lev, r1: cl(0.42 * sp * (0.8 + 0.2 * lev), 3.5, 11) });
              st.cool[idx] = t;
            }
          }
        }
        st.ab[idx] += ((r > 0 ? 1 : 0) - st.ab[idx]) * al;
      }
  }
}

function step(S, d, quiet) {
  S.t += d;
  configure(S);
  ranks(S, d, quiet);
  for (let i = S.rings.length - 1; i >= 0; i--) {
    const r = S.rings[i];
    r.age += d;
    if (r.age >= r.dur) S.rings.splice(i, 1);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = (input && input.knobValues) || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!S.k) {
    S.k = [0, 2, 0, 0.06];
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] = kv[i];
    // run twenty seconds of ranks before the first frame, so the opening map has its towns settled
    configure(S);
    for (let i = 0; i < 200; i++) step(S, 0.1, i < 120);
  } else {
    const al = 1 - exp(-d / 0.25);
    for (let i = 0; i < 4; i++) if (isFinite(kv[i])) S.k[i] += (kv[i] - S.k[i]) * al;
  }
  if (d > 0) step(S, d, false);
}

const BUF = new Float32Array(W * H * 3);
const GR = [0, 0, 0], T3 = [0, 0, 0], T2 = [0, 0, 0], CL = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
const EDG = new Float64Array(NL), CXN = new Float64Array(NL), CYN = new Float64Array(NL), CI = new Int32Array(NL), CJ = new Int32Array(NL);

// prosperity: two slow waves across the plain, 0..1
function prosper(x, y, t) {
  return 0.5 + 0.28 * sin(0.05 * (0.8 * x + 0.6 * y) - 0.21 * t + 1) + 0.22 * sin(0.033 * (-0.5 * x + 0.87 * y) + 0.13 * t + 2.4);
}

function lump(cx, cy, sig, amp, c) {
  const R = floor(sig * 3) + 1, is2 = 1 / (2 * sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R), y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, a = 255 * amp * exp(-(dx * dx + dy * dy) * is2), o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

function ring(cx, cy, rad, sig, amp, c) {
  const R = ceil(rad + sig * 3) + 1, is2 = 1 / (sig * sig);
  const x0 = max(0, floor(cx) - R), x1 = min(W - 1, floor(cx) + R), y0 = max(0, floor(cy) - R), y1 = min(H - 1, floor(cy) + R);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy, e = sqrt(dx * dx + dy * dy) - rad, a = 255 * amp * exp(-e * e * is2), o = (y * W + x) * 3;
      BUF[o] += c[0] * a; BUF[o + 1] += c[1] * a; BUF[o + 2] += c[2] * a;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.k) return;
  const L = S.L, t = S.t, seed = S.seed, hue = S.hue;
  hsv(0.685, 0.85, 0.13, GR);
  hsv(RK[3][0] + 0.0 + hue, 0.7, 1, T3);
  const gain = min(1, pow(S.a / 12, 1.3));
  const fade0 = sm(5, 7, S.a);
  for (let n = 0; n < NL; n++) for (let c = 0; c < 3; c++) CL[n][c] = S.cc[n][c] * 255;
  const WX = S.WX, WY = S.WY, GX = S.GX, GY = S.GY;

  for (let y = 0; y < H; y++) {
    const wx = WX[y], gx = GX[y];
    for (let x = 0; x < W; x++) {
      const px = x + wx, py = y + WY[x], gy = GY[x];
      const fs = 1 / sqrt(1 + 0.5 * (gx * gx + gy * gy) + abs(gx * gy));
      // nearest centre and edge distance in every net
      for (let n = 0; n < NL; n++) {
        const o = n * STR, dx = px - L[o], dy = py - L[o + 1];
        const i0 = floor(L[o + 2] * dx + L[o + 3] * dy), j0 = floor(L[o + 4] * dx + L[o + 5] * dy);
        let bd = 1e18, bi = 0, bj = 0, bx = 0, by = 0;
        for (let di = 0; di < 2; di++)
          for (let dj = 0; dj < 2; dj++) {
            const cx = L[o] + (i0 + di) * L[o + 6] + (j0 + dj) * L[o + 8], cy = L[o + 1] + (i0 + di) * L[o + 7] + (j0 + dj) * L[o + 9];
            const ex = px - cx, ey = py - cy, dd = ex * ex + ey * ey;
            if (dd < bd) { bd = dd; bi = i0 + di; bj = j0 + dj; bx = ex; by = ey; }
          }
        const p0 = abs(bx * L[o + 11] + by * L[o + 12]), p1 = abs(bx * L[o + 13] + by * L[o + 14]), p2 = abs(bx * L[o + 15] + by * L[o + 16]);
        EDG[n] = (0.5 * L[o + 10] - max(p0, p1, p2)) * fs;
        CI[n] = bi; CJ[n] = bj; CXN[n] = bx; CYN[n] = by;
      }
      let r = GR[0] * 255, g = GR[1] * 255, b = GR[2] * 255;
      // tints of the two top ranks
      for (let n = 2; n < 4; n++) {
        const o = n * STR, cxs = L[o] + CI[n] * L[o + 6] + CJ[n] * L[o + 8], cys = L[o + 1] + CI[n] * L[o + 7] + CJ[n] * L[o + 9];
        const h = hash(n, CI[n], CJ[n], seed), P = prosper(cxs, cys, t);
        const rad = sqrt(CXN[n] * CXN[n] + CYN[n] * CYN[n]) / (0.58 * L[o + 10]);
        const glow = (0.35 + 0.65 * P) * (0.75 + 0.25 * (1 - min(1, rad)));
        if (n === 3) {
          const k = 0.18 * glow;
          r += T3[0] * 255 * k; g += T3[1] * 255 * k; b += T3[2] * 255 * k;
        } else {
          hsv(0.69 + 0.3 * (h - 0.5) + hue, 0.65, 1, T2);
          const k = 0.22 * glow;
          r += T2[0] * 255 * k; g += T2[1] * 255 * k; b += T2[2] * 255 * k;
        }
      }
      // the lines, finest first, each over the last
      for (let n = 0; n < NL; n++) {
        const e = EDG[n], hw = HW[n];
        if (e > hw + 1.4) continue;
        if (n > 0) {
          const cs = CAS[n] * (1 - sm(hw + 0.1, hw + 1.4, e));
          r *= 1 - cs; g *= 1 - cs; b *= 1 - cs;
        }
        let a = (1 - sm(hw - 0.75, hw + 0.75, e)) * AL[n] * gain;
        if (n === 0) a *= fade0;
        r += (CL[n][0] - r) * a; g += (CL[n][1] - g) * a; b += (CL[n][2] - b) * a;
      }
      const o3 = (y * W + x) * 3;
      BUF[o3] = r; BUF[o3 + 1] = g; BUF[o3 + 2] = b;
    }
  }

  // the towns: a dot on every centre, the finer ones absorbed into the coarser
  for (let m = 0; m < NL; m++) {
    const o = m * STR, st = m < NL - 1 ? S.st[m] : null;
    bounds(S, m, 12);
    const B = S.bnd, b0 = B[0], b1 = B[1], c0 = B[2], c1 = B[3];
    const c = S.cc[m];
    for (let i = b0; i <= b1; i++)
      for (let j = c0; j <= c1; j++) {
        const px = L[o] + i * L[o + 6] + j * L[o + 8], py = L[o + 1] + i * L[o + 7] + j * L[o + 9];
        if (px < -12 || px > W + 12 || py < -12 || py > H + 12) continue;
        let vis = 1;
        if (st) {
          const ii = i + OFS, jj = j + OFS;
          if (ii < 0 || jj < 0 || ii >= SZ || jj >= SZ) continue;
          vis = 1 - st.ab[ii * SZ + jj];
        }
        if (m === 0) vis *= fade0;
        if (vis < 0.02) continue;
        unbend(S, px, py, XY);
        const sx = XY[0], sy = XY[1];
        if (sx < -6 || sx > W + 6 || sy < -6 || sy > H + 6) continue;
        const h1 = hash(m, i, j, seed), h2 = hash(m + 9, i, j, seed);
        const pul = sin((TAU * t) / (PT[m] * (0.75 + 0.5 * h1)) + TAU * h2);
        const P = prosper(sx, sy, t);
        const amp = vis * DA[m] * (0.88 + 0.14 * pul + 0.24 * (P - 0.5));
        lump(sx, sy, SG[m] * (1 + 0.1 * pul), amp, c);
        lump(sx, sy, SG[m] * 2.3, 0.1 * vis, c);
      }
  }
  // promotions grow a ring out of the town, demotions draw one back in
  for (let i = 0; i < S.rings.length; i++) {
    const rg = S.rings[i], u = rg.age / rg.dur, c = S.cc[rg.lev];
    const e = rg.up ? 1 - (1 - u) * (1 - u) : (1 - u) * (1 - u);
    const rad = 1.5 + (rg.r1 - 1.5) * (rg.up ? e : 1 - (1 - e));
    const amp = 1.0 * sin(PI * pow(u, 0.6));
    ring(rg.x, rg.y, rad, 1.0 + 0.03 * rad, amp, c);
    lump(rg.x, rg.y, 1.5 + 0.2 * rg.lev, 0.45 * (1 - u) * (1 - u), c);
  }

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3, r = BUF[o], g = BUF[o + 1], b = BUF[o + 2];
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
}
