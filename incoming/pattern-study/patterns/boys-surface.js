// ===== Patternflow pattern =====
// Title:   Boy's Surface
// Family:  topology
// Idea:    Boy's immersion of the projective plane turns slowly about its three-fold axis in the top square while a level plane sweeps up and down through it, and the bottom square looks down on the cut: one closed curve that changes shape with the height and crosses itself three ways at the triple point, over a surface coloured warm on one face and cool on the other so the seam where the two meet shows it has only one side.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Boy's surface (Werner Boy, 1901), in the parametrisation of Robert Bryant and Rob Kusner, pattern round 31
// Round:   31
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tilt=0..1, Bands=0..1
//
// Knob 1: Hue. Turns both faces round the wheel together; at 0 the front of the disk is pink and the back is cyan.
// Knob 2: Speed. At 2 the surface turns a third of the way round, which brings it back to the same shape, in about nine seconds and the plane sweeps up and down once in twenty; at 0.2 both go ten times slower.
// Knob 3: Tilt. The height of the eye: at 0 it looks across the surface from 22 degrees above the level, at 1 straight down the three-fold axis as the bottom square does, through the glass onto the cut.
// Knob 4: Bands. Circles of the parameter disk painted on the surface as dark stripes, from two broad ones at 0 to nine at 1, counted in from the seam, which always stays light.
// Buttons: K1 tap brings the plane to the height of the triple point in under a second and holds it there five seconds, where the cut is three loops through one point.

const W = 64, S = 64, N = W * 128;
const { min, max, floor, sqrt, sin, cos, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The disk is sampled on NR rings of NA points; ring 0 is the centre.
const NR = 64, NA = 192, NP = (NR + 1) * NA, NC = NR * NA;
// The surface lies within 1.571 of (0, 0, ZC), so 19.4 LEDs a unit keeps
// it inside its square at every turn and tilt. The triple point is at the
// origin, the top of the lobes at z = 0.443 and the pole at z = -2.
const ZC = -0.779, SC = 19.4, CX = 31.5, CY = 31.5, PY = 64 + 31.5;
const Z0 = -1.45, Z1 = 0.3;

// Bryant and Kusner's formula for one point w = re + i im of the closed
// unit disk, written out in real arithmetic.
const S5 = sqrt(5);
function boy(re, im, out, o) {
  const r2 = re * re - im * im, i2 = 2 * re * im;
  const r3 = r2 * re - i2 * im, i3 = r2 * im + i2 * re;
  const r4 = r2 * r2 - i2 * i2, i4 = 2 * r2 * i2;
  const r6 = r3 * r3 - i3 * i3, i6 = 2 * r3 * i3;
  const dr = r6 + S5 * r3 - 1, di = i6 + S5 * i3, dd = dr * dr + di * di;
  // w (1 - w^4), w (1 + w^4) and 1 + w^6, each over the denominator.
  const ar = re * (1 - r4) + im * i4, ai = im * (1 - r4) - re * i4;
  const br = re * (1 + r4) - im * i4, bi = im * (1 + r4) + re * i4;
  const g1 = (-1.5 * (ai * dr - ar * di)) / dd;
  const g2 = (-1.5 * (br * dr + bi * di)) / dd;
  const g3 = (i6 * dr - (1 + r6) * di) / dd - 0.5;
  const g = g1 * g1 + g2 * g2 + g3 * g3;
  out[o] = g1 / g;
  out[o + 1] = g2 / g;
  out[o + 2] = g3 / g;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Points, normals and cells, once. The normal is
// d/dRe x d/dIm of the map, the orientation of the disk: across the seam,
// where antipodal points of the boundary circle meet, it points the other
// way, and the colours follow it.
function build(G) {
  const P = G.p, Nn = G.n, T = new Float64Array(12);
  for (let i = 0; i <= NR; i++) {
    const r = i / NR;
    for (let j = 0; j < NA; j++) {
      const a = (TAU * j) / NA, re = r * cos(a), im = r * sin(a), k = i * NA + j, h = 1e-4;
      boy(re, im, P, k * 3);
      boy(re + h, im, T, 0);
      boy(re - h, im, T, 3);
      boy(re, im + h, T, 6);
      boy(re, im - h, T, 9);
      const ux = T[0] - T[3], uy = T[1] - T[4], uz = T[2] - T[5], vx = T[6] - T[9], vy = T[7] - T[10], vz = T[8] - T[11];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = 1 / (sqrt(nx * nx + ny * ny + nz * nz) + 1e-30);
      Nn[k * 3] = nx * l;
      Nn[k * 3 + 1] = ny * l;
      Nn[k * 3 + 2] = nz * l;
    }
  }
  // The corners of each grid cell, and its mean height, which decides
  // whether it is under the plane.
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < NA; j++) {
      const c = i * NA + j, o = c * 4, q = [c, c + NA, (i + 1) * NA + ((j + 1) % NA), i * NA + ((j + 1) % NA)];
      for (let e = 0; e < 4; e++) G.cc[o + e] = q[e];
      G.cz[c] = (P[q[0] * 3 + 2] + P[q[1] * 3 + 2] + P[q[2] * 3 + 2] + P[q[3] * 3 + 2]) / 4;
    }
  // Cells of the grid by height: bin b lists every cell whose corners span
  // a height in it, so the cut only looks at the cells near the plane.
  const cnt = new Int32Array(NB + 1), lo = new Int32Array(NR * NA), hi = new Int32Array(NR * NA);
  for (let i = 0; i < NR; i++)
    for (let j = 0; j < NA; j++) {
      const c = i * NA + j;
      let a = 9, b = -9;
      for (let e = 0; e < 4; e++) (a = min(a, P[G.cc[c * 4 + e] * 3 + 2])), (b = max(b, P[G.cc[c * 4 + e] * 3 + 2]));
      lo[c] = bin(a);
      hi[c] = bin(b);
      for (let k = lo[c]; k <= hi[c]; k++) cnt[k + 1]++;
    }
  for (let k = 0; k < NB; k++) cnt[k + 1] += cnt[k];
  G.binAt = cnt.slice();
  G.cells = new Int32Array(cnt[NB]);
  for (let c = 0; c < NR * NA; c++) for (let k = lo[c]; k <= hi[c]; k++) G.cells[cnt[k]++] = c;
}

// Height bins for the cut, from the pole at -2 to the top at 0.45.
const NB = 96;
const bin = (z) => cl(floor(((z + 2.01) / 2.47) * NB), 0, NB - 1);

export function setup(params) {
  const A = (n) => new Float32Array(n), I = (n) => new Int32Array(n);
  params.s = {
    p: A(NP * 3), n: A(NP * 3), cc: I(NC * 4), cz: A(NC), binAt: null, cells: null,
    // Each point's place in the side view, its depth there, and its row in the plan.
    vx: A(NP), vy: A(NP), vd: A(NP), vp: A(NP),
    // Depth and point per LED: the side view under the plane and over it,
    // and the plan, which looks straight down on what is under it.
    za: A(W * S), ia: I(W * S), zo: A(W * S), io: I(W * S), zp: A(W * S), ip: I(W * S),
    line: A(N), col: A(N * 3), pal: A(12), c3: A(3), seg: A(4096 * 2), band: A(NR + 1),
    L: [0, 1, 2].map(() => ({ a: A(W * S), b: A(W * S), c: A(W * S), f: new Int8Array(W * S), g: new Int8Array(W * S) })),
    az: 0.4, sw: PI / 2, hold: 0, hw: 0, hue: 0, tilt: 0, bands: 0.06, zc: -0.5, palHue: -1, built: false,
  };
}
export function update(dt, input, params) {
  if (!params.s) setup(params);
  const G = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  if (!G.built) build(G), (G.built = true);
  G.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3);
  G.tilt = cl(k[2], 0, 1);
  G.bands = cl(k[3], 0, 1);
  // A third of a turn in 8.7 s and one sweep of the plane in 20 s at Speed 2.
  G.az += d * sp * 0.12;
  G.sw += (d * sp * TAU) / 40;
  const b = input.btnPressed || [];
  if (b[0]) G.hold = 6.6;
  G.hold = max(0, G.hold - d);
  // The plane eases over to the triple point, at z = 0, in 0.8 s, and back
  // to its sweep in 0.8 s once the hold is over.
  G.hw = cl(G.hw + (G.hold > 0.8 ? d : -d) / 0.8, 0, 1);
  const zs = Z0 + (Z1 - Z0) * (0.5 - 0.5 * cos(G.sw));
  G.zc = zs * (1 - sm(G.hw));
}

// Two colours for each face of the disk, one in the light and one in
// shadow. A dim orange or yellow reads brown, so a face whose hue lies
// between red and yellow turns crimson in shadow, and one between yellow
// and green turns green; other faces lean a little toward violet.
function palette(G) {
  const t = G.pal;
  for (let f = 0; f < 2; f++) {
    let h = G.hue + (f ? 0.52 : 0.92);
    h -= floor(h);
    const sh = h < 0.17 ? 0.94 : h < 0.33 ? 0.33 : h + cl(0.7 - h, -0.04, 0.04);
    hsv(h, f ? 0.8 : 0.7, 1, t, f * 3);
    hsv(sh, 0.85, 1, t, 6 + f * 3);
  }
  G.palHue = G.hue;
}

// A soft line one LED wide into the light buffer: points every half LED,
// each shared between its four nearest LEDs.
function soft(buf, x0, y0, x1, y1, w, ylo, yhi) {
  const n = max(1, Math.ceil(sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) * 2)), ww = (w * sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)) / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t - 0.5, y = y0 + (y1 - y0) * t - 0.5;
    const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
    for (let c = 0; c < 4; c++) {
      const xx = ix + (c & 1), yy = iy + (c >> 1);
      if (xx < 0 || xx >= W || yy < ylo || yy >= yhi) continue;
      buf[yy * W + xx] += ww * (c & 1 ? fx : 1 - fx) * (c >> 1 ? fy : 1 - fy);
    }
  }
}

// The colour of point k on face f in a view whose right, up and
// toward-the-eye axes carry the normal to (a, b, c), into G.c3. The light is
// two-sided Lambert from upper left in front, with a highlight, and the
// disk's circles stripe it.
function shade(G, k, a, b, c, gain, f) {
  const pal = G.pal, sg = f ? -1 : 1, o = f * 3, so = 6 + o;
  const ld = max(0, sg * (a * LX + b * LY + c * LZ)), h2 = max(0, sg * (a * HX + b * HY + c * HZ)) ** 2, h8 = (h2 * h2) ** 2;
  // The shadow colour gives way to the lit one with the square of the light,
  // and later still in the dimmed glass and plan.
  const lit = (0.24 + 0.76 * ld) * G.band[(k / NA) | 0] * gain, sp = h8 * h8 * h8 * 0.55 * gain, m = ld * ld * gain;
  G.c3[0] = ((pal[so] + (pal[o] - pal[so]) * m) * lit + sp) * 255;
  G.c3[1] = ((pal[so + 1] + (pal[o + 1] - pal[so + 1]) * m) * lit + sp) * 255;
  G.c3[2] = ((pal[so + 2] + (pal[o + 2] - pal[so + 2]) * m) * lit + sp) * 255;
}
const LX = -0.45, LY = 0.62, LZ = 0.64, HL = 1 / sqrt(LX * LX + LY * LY + (LZ + 1) ** 2), HX = LX * HL, HY = LY * HL, HZ = (LZ + 1) * HL;

// One grid cell into a depth buffer: every LED whose centre lies in the
// box round its four corners. The boxes of neighbouring cells overlap, so
// the turning surface has no holes.
function fill(zb, ib, X, Y, cc, o, D, k) {
  const a = cc[o], b = cc[o + 1], c = cc[o + 2], d = cc[o + 3];
  let xa = X[a], xb = X[b], ya = Y[a], yb = Y[b];
  if (xa > xb) (xb = xa), (xa = X[b]);
  if (ya > yb) (yb = ya), (ya = Y[b]);
  let t = X[c];
  if (t < xa) xa = t;
  else if (t > xb) xb = t;
  t = X[d];
  if (t < xa) xa = t;
  else if (t > xb) xb = t;
  t = Y[c];
  if (t < ya) ya = t;
  else if (t > yb) yb = t;
  t = Y[d];
  if (t < ya) ya = t;
  else if (t > yb) yb = t;
  // LED centres sit at whole numbers plus a half.
  let x0 = (xa - 0.5) | 0, y0 = (ya - 0.5) | 0, x1 = (xb + 0.5) | 0, y1 = (yb + 0.5) | 0;
  if (xa - 0.5 > x0) x0++;
  if (ya - 0.5 > y0) y0++;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 > W) x1 = W;
  if (y1 > S) y1 = S;
  for (let yy = y0; yy < y1; yy++) for (let q = yy * W + x0, qe = yy * W + x1; q < qe; q++) if (D > zb[q]) (zb[q] = D), (ib[q] = k);
}

// Every cell into the side view's solid or glass layer by its mean height,
// at the mean depth of its corners, and the solid ones into the plan too.
function cellsIn(G, zc) {
  const { cc, cz, vx, vy, vd, vp, za, ia, zo, io, zp, ip } = G;
  for (let c = 0, o = 0; c < NC; c++, o += 4) {
    const k = cc[o], D = (vd[k] + vd[cc[o + 1]] + vd[cc[o + 2]] + vd[cc[o + 3]]) * 0.25;
    if (cz[c] <= zc) fill(za, ia, vx, vy, cc, o, D, k), fill(zp, ip, vx, vp, cc, o, cz[c], k);
    else fill(zo, io, vx, vy, cc, o, D, k);
  }
}

// The normal of each LED's point in the eye's frame (right, up, toward the
// eye; the plan looks down the axis) and the face of the disk it shows. A
// lone LED showing the other face from every lit neighbour is a cell's box
// poking past a fold, and takes their face.
function normals(G, ids, ca, sa, ce, se, plan, L) {
  const n = G.n, { a, b, c, f, g } = L;
  for (let q = 0; q < W * S; q++) {
    const k = ids[q];
    if (k < 0) {
      f[q] = -1;
      continue;
    }
    const nx = n[k * 3], ny = n[k * 3 + 1], nz = n[k * 3 + 2], nyr = nx * sa + ny * ca;
    a[q] = nx * ca - ny * sa;
    b[q] = plan ? nyr : nyr * se + nz * ce;
    c[q] = plan ? nz : nz * se - nyr * ce;
    f[q] = c[q] >= 0 ? 0 : 1;
  }
  for (let q = 0; q < W * S; q++) {
    const fq = (g[q] = f[q]);
    if (fq < 0) continue;
    const x = q & (W - 1), l = x > 0 ? f[q - 1] : -1, r = x < W - 1 ? f[q + 1] : -1, u = q >= W ? f[q - W] : -1, d = q < W * S - W ? f[q + W] : -1;
    if (l !== fq && r !== fq && u !== fq && d !== fq && (l >= 0) + (r >= 0) + (u >= 0) + (d >= 0) >= 2) g[q] = 1 - fq;
  }
}

export function draw(display, params) {
  const G = params.s;
  if (!G || !G.built) return;
  if (G.palHue !== G.hue) palette(G);
  const { p, n, cc, cz, vx, vy, vd, vp, za, ia, zo, io, zp, ip, line, col, seg, c3 } = G;
  const ca = cos(G.az), sa = sin(G.az), el = (22 + 68 * G.tilt) * (PI / 180), ce = cos(el), se = sin(el), zc = G.zc;
  // The disk's circles: each ring of the grid is lit by its band, from 1.2
  // on the light stripes to 0.35 in the middle of the dark ones.
  const nb = 2 + 7 * G.bands;
  for (let i = 0; i <= NR; i++) G.band[i] = 1.2 - 0.85 * (0.5 - 0.5 * cos((TAU * nb * (NR - i)) / NR));
  za.fill(-1e9);
  zo.fill(-1e9);
  zp.fill(-1e9);
  ia.fill(-1);
  io.fill(-1);
  ip.fill(-1);
  // The side view in two layers: what is under the plane is solid, what is
  // over it is glass. The plan takes what is under the plane, nearest the
  // eye above first.
  for (let k = 0, o = 0; k < NP; k++, o += 3) {
    const x = p[o], y = p[o + 1], z = p[o + 2], xr = x * ca - y * sa, yr = x * sa + y * ca;
    vx[k] = CX + SC * xr;
    vy[k] = CY - SC * (yr * se + (z - ZC) * ce);
    vd[k] = z * se - yr * ce;
    vp[k] = CY - SC * yr;
  }
  cellsIn(G, zc);
  normals(G, ia, ca, sa, ce, se, false, G.L[0]);
  normals(G, io, ca, sa, ce, se, false, G.L[1]);
  normals(G, ip, ca, sa, ce, se, true, G.L[2]);
  const [A, O, Pl] = G.L;
  for (let q = 0; q < W * S; q++) {
    const o = q * 3, oo = (W * S + q) * 3;
    let r = 0, g = 0, b = 0, k = ia[q];
    if (k >= 0) shade(G, k, A.a[q], A.b[q], A.c[q], 1, A.g[q]), (r = c3[0]), (g = c3[1]), (b = c3[2]);
    k = io[q];
    if (k >= 0 && zo[q] > za[q]) {
      // Glass: 60 percent of its own light over 55 of what is behind.
      shade(G, k, O.a[q], O.b[q], O.c[q], 0.6, O.g[q]);
      (r = r * 0.55 + c3[0]), (g = g * 0.55 + c3[1]), (b = b * 0.55 + c3[2]);
    }
    (col[o] = r), (col[o + 1] = g), (col[o + 2] = b);
    k = ip[q];
    if (k >= 0) shade(G, k, Pl.a[q], Pl.b[q], Pl.c[q], 0.5, Pl.g[q]), (col[oo] = c3[0]), (col[oo + 1] = c3[1]), (col[oo + 2] = c3[2]);
    else col[oo] = col[oo + 1] = col[oo + 2] = 0;
  }
  // The cut: in each grid cell the plane crosses, the points where it
  // crosses the cell's edges, two to a piece of the curve (four in a
  // saddle, paired in order round the cell).
  line.fill(0);
  let ns = 0;
  const bz = bin(zc), cells = G.cells, zs = [0, 0, 0, 0], cs = [0, 0, 0, 0];
  for (let m = G.binAt[bz]; m < G.binAt[bz + 1] && ns < 2040; m++) {
    const c = cells[m];
    for (let e = 0; e < 4; e++) cs[e] = cc[c * 4 + e];
    let up = 0;
    for (let e = 0; e < 4; e++) up += (zs[e] = p[cs[e] * 3 + 2] - zc) > 0;
    if (up === 0 || up === 4) continue;
    for (let e = 0; e < 4; e++) {
      const z0 = zs[e], z1 = zs[(e + 1) & 3];
      if (z0 > 0 === z1 > 0) continue;
      const t = z0 / (z0 - z1), A = cs[e] * 3, B = cs[(e + 1) & 3] * 3;
      seg[ns * 2] = p[A] + (p[B] - p[A]) * t;
      seg[ns * 2 + 1] = p[A + 1] + (p[B + 1] - p[A + 1]) * t;
      ns++;
    }
  }
  // Each piece soft in both views; in the side view a piece behind the
  // solid is faint.
  for (let s = 0; s + 1 < ns; s += 2) {
    const ax = seg[s * 2], ay = seg[s * 2 + 1], bx = seg[s * 2 + 2], by = seg[s * 2 + 3];
    const axr = ax * ca - ay * sa, ayr = ax * sa + ay * ca, bxr = bx * ca - by * sa, byr = bx * sa + by * ca;
    const X0 = CX + SC * axr, X1 = CX + SC * bxr, Y0 = CY - SC * (ayr * se + (zc - ZC) * ce), Y1 = CY - SC * (byr * se + (zc - ZC) * ce);
    const D = zc * se - ((ayr + byr) / 2) * ce, qx = Math.round((X0 + X1) / 2 - 0.5), qy = Math.round((Y0 + Y1) / 2 - 0.5);
    const zq = qx >= 0 && qx < W && qy >= 0 && qy < S ? za[qy * W + qx] : -1e9;
    soft(line, X0, Y0, X1, Y1, D > zq - 0.1 ? 1 : 0.22, 0, S);
    soft(line, X0, PY - SC * ayr, X1, PY - SC * byr, 1, S, 128);
  }
  // Ticks at the two edges of the side view mark the plane's height on the
  // axis.
  const ty = CY - SC * (zc - ZC) * ce, ty0 = floor(ty - 0.5), fy = ty - 0.5 - ty0;
  for (const x of [0, 1, 62, 63])
    for (let c = 0; c < 2; c++) {
      const yy = ty0 + c;
      if (yy >= 0 && yy < S) line[yy * W + x] += (c ? fy : 1 - fy) * (x === 0 || x === 63 ? 1 : 0.45);
    }
  for (let q = 0, o = 0; q < N; q++, o += 3) {
    const l = min(1, line[q] * 1.1);
    const r = min(255, col[o]), g = min(255, col[o + 1]), b = min(255, col[o + 2]);
    display.setPixel(q % W, (q / W) | 0, r + (255 - r) * l, g + (244 - g) * l, b + (205 - b) * l);
  }
}
