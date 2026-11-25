// ===== Patternflow pattern =====
// Title:   Terrazzo
// Family:  terrazzo
// Idea:    A terrazzo floor is ground down a layer at a time, so marble chips of rose, ochre, ivory, green and slate set in dark cement appear as points, swell into faceted polygons, shrink and vanish while the cutting surface heaves slowly, grazing the top of one chip and passing through the heart of the next.
// Author:  patternflow-lab
// Date:    2026-11-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the plane section of a random solid, whose area share equals the solid's volume share (Achille Delesse, 1847) and whose chip sizes are the corpuscle problem (Sven Wicksell, 1925), both from memory; the hashed lattice of convex chips that never repeats along the cutting axis, the heaving cutting surface of four sines, the screen-space edge distance divided by the surface slope, the overlap seams and the polished rim and sheen are original, pattern round 251
// Round:   251
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Grind=0..3, Chip=0.6..1.5, Swell=0..1
//
// Knob 1: Hue. Turns the whole palette of chips round the wheel; it opens on cream, ochre, rust, rose, green and slate marble in charcoal cement.
// Knob 2: Grind. 0 to 3, opening at 2. How fast the floor is ground down: at 0 it creeps and the heaving of the surface still moves the chips, at 3 they bloom and die half as fast again as at the opening.
// Knob 3: Chip. 0.6 to 1.5, opening at 0.6. The size of the chips: the lattice is stretched about the middle of the panel, so the chips swell and shrink smoothly from about 13 LED a cell to 33.
// Knob 4: Swell. 0 to 1, opening at 0.06. How far the cutting surface heaves: at 0 it is a flat plane and chips grow and shrink in step with the depth, at 1 contour-like chips follow the hills and hollows of the surface.

// The floor is a lattice of cells with a hashed marble chip, or two, in each. The cutting surface z(x, y, t) sinks
// through it at the grinding speed and heaves with four sines, and every LED shows what the surface cuts there:
// the chip whose faces it is deepest inside, or the cement. Cells come from a hash of their integer coordinates, so
// the lattice runs on in z for ever with no repeat; only the cells the surface can reach are built.
const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, sqrt, exp, sin, cos, PI } = Math;
const TP = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fin = (v, d) => (Number.isFinite(v) ? v : d);

const S0 = 22;                 // LED per lattice cell at Chip = 1
const PCHIP = 0.86;            // chance that a cell holds a chip
const PTWO = 0.07;             // chance of a second, smaller one
const RCAP = 1.2;              // chips are shrunk until their bounding radius is under this many cells

// the cutting surface: four sines of the lattice position, none dividing another
const SKX = [0.83, -0.47, 1.13, 0.29];
const SKY = [0.31, 0.97, -0.58, 1.31];
const SW = [0.2163, 0.3391, 0.4399, 0.1371];
const SA = [0.42, 0.3, 0.2, 0.08];
const SK = 1.18;               // overall spatial frequency of the surface, radians a cell

// marble: hue, saturation, value, weight
const PAL = [
  [0.120, 0.13, 0.80, 1.8],    // cream
  [0.090, 0.22, 0.66, 1.0],    // travertine
  [0.035, 0.52, 0.72, 1.0],    // terracotta
  [0.105, 0.58, 0.80, 0.9],    // ochre
  [0.380, 0.30, 0.52, 1.0],    // sage
  [0.580, 0.32, 0.62, 1.0],    // slate blue
  [0.970, 0.26, 0.84, 0.9],    // blush
  [0.620, 0.18, 0.34, 0.7],    // charcoal
];
const PTOT = PAL.reduce((a, p) => a + p[3], 0);

const hv = [0, 0, 0];
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- hashing -----------------------------------------------------------------
let RS = 1;
function seedCell(i, j, k, n, seed) {
  let h = (Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b) ^ seed) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  RS = h | 0;
}
function rn() {
  RS = (RS + 0x6d2b79f5) | 0;
  let t = Math.imul(RS ^ (RS >>> 15), 1 | RS);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- chips -------------------------------------------------------------------
// A chip is the convex polyhedron { p : n_i . (p - c) <= h_i } for eight jittered, randomly turned octahedron
// normals with their own distances (some planes lie too far out to touch the body, so five to eight faces
// show), squashed along a random axis for the flat ones. P holds n_x, n_y, n_z, h for each plane.
const NM = 8;
const OCT = [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]];

const BB = new Float64Array(6), ACT = new Uint8Array(NM), FV = new Float64Array(NM);
function boundRadius(P) {
  let best = 0;
  BB[0] = BB[2] = BB[4] = 1e9; BB[1] = BB[3] = BB[5] = -1e9;
  ACT.fill(0);
  for (let a = 0; a < NM; a++) {
    const a0 = P[4 * a], a1 = P[4 * a + 1], a2 = P[4 * a + 2], ha = P[4 * a + 3];
    for (let b = a + 1; b < NM; b++) {
      const b0 = P[4 * b], b1 = P[4 * b + 1], b2 = P[4 * b + 2], hb = P[4 * b + 3];
      for (let c = b + 1; c < NM; c++) {
        const c0 = P[4 * c], c1 = P[4 * c + 1], c2 = P[4 * c + 2], hc = P[4 * c + 3];
        const m0 = b1 * c2 - b2 * c1, m1 = b0 * c2 - b2 * c0, m2 = b0 * c1 - b1 * c0;
        const det = a0 * m0 - a1 * m1 + a2 * m2;
        if (abs(det) < 1e-3) continue;
        const x = (ha * m0 - a1 * (hb * c2 - b2 * hc) + a2 * (hb * c1 - b1 * hc)) / det;
        const y = (a0 * (hb * c2 - b2 * hc) - ha * m1 + a2 * (b0 * hc - hb * c0)) / det;
        const z = (a0 * (b1 * hc - hb * c1) - a1 * (b0 * hc - hb * c0) + ha * m2) / det;
        let ok = true;
        for (let q = 0; q < NM; q++) if (P[4 * q] * x + P[4 * q + 1] * y + P[4 * q + 2] * z > P[4 * q + 3] + 1e-4) { ok = false; break; }
        if (ok) {
          ACT[a] = ACT[b] = ACT[c] = 1;
          const r2 = x * x + y * y + z * z;
          if (r2 > best) best = r2;
          if (x < BB[0]) BB[0] = x;
          if (x > BB[1]) BB[1] = x;
          if (y < BB[2]) BB[2] = y;
          if (y > BB[3]) BB[3] = y;
          if (z < BB[4]) BB[4] = z;
          if (z > BB[5]) BB[5] = z;
        }
      }
    }
  }
  return sqrt(best);
}

function mkChip(i, j, k, n, seed) {
  seedCell(i, j, k, n, seed);
  if (rn() >= (n === 0 ? PCHIP : PTWO)) return null;
  const c = { cx: i + 0.18 + 0.64 * rn(), cy: j + 0.18 + 0.64 * rn(), cz: k + 0.18 + 0.64 * rn(), R: 0, m: 0, P: new Float64Array(NM * 4), next: null };
  let r = (0.30 + 0.28 * rn()) * (n === 0 ? 1 : 0.55);
  // a random turn: unit quaternion to matrix
  let qa = rn() - 0.5, qb = rn() - 0.5, qc = rn() - 0.5, qd = rn() - 0.5;
  const ql = 1 / sqrt(qa * qa + qb * qb + qc * qc + qd * qd + 1e-9);
  qa *= ql; qb *= ql; qc *= ql; qd *= ql;
  const m00 = 1 - 2 * (qc * qc + qd * qd), m01 = 2 * (qb * qc - qa * qd), m02 = 2 * (qb * qd + qa * qc);
  const m10 = 2 * (qb * qc + qa * qd), m11 = 1 - 2 * (qb * qb + qd * qd), m12 = 2 * (qc * qd - qa * qb);
  const m20 = 2 * (qb * qd - qa * qc), m21 = 2 * (qc * qd + qa * qb), m22 = 1 - 2 * (qb * qb + qc * qc);
  // flat ones: squash along a random axis
  let fx = 0, fy = 0, fz = 0, ff = 1;
  if (rn() < 0.34) {
    fx = rn() - 0.5; fy = rn() - 0.5; fz = rn() - 0.5;
    const fl = 1 / sqrt(fx * fx + fy * fy + fz * fz + 1e-9);
    fx *= fl; fy *= fl; fz *= fl;
    ff = 0.38 + 0.3 * rn();
  }
  const P = c.P;
  for (let a = 0; a < NM; a++) {
    let x = OCT[a][0] * 0.577 + 0.4 * (rn() - 0.5) * 2, y = OCT[a][1] * 0.577 + 0.4 * (rn() - 0.5) * 2, z = OCT[a][2] * 0.577 + 0.4 * (rn() - 0.5) * 2;
    let l = 1 / sqrt(x * x + y * y + z * z); x *= l; y *= l; z *= l;
    let X = m00 * x + m01 * y + m02 * z, Y = m10 * x + m11 * y + m12 * z, Z = m20 * x + m21 * y + m22 * z;
    let h = r * (0.8 + 0.7 * rn());
    if (ff !== 1) {
      const d = (X * fx + Y * fy + Z * fz) * (1 / ff - 1);
      X += d * fx; Y += d * fy; Z += d * fz;
      l = sqrt(X * X + Y * Y + Z * Z); h /= l; X /= l; Y /= l; Z /= l;
    }
    P[4 * a] = X; P[4 * a + 1] = Y; P[4 * a + 2] = Z; P[4 * a + 3] = h;
  }
  let R = boundRadius(P);
  if (!(R > 0.05)) return null;
  // keep only the planes that make a face
  let m = 0;
  for (let a = 0; a < NM; a++) if (ACT[a]) { for (let q = 0; q < 4; q++) P[4 * m + q] = P[4 * a + q]; m++; }
  // nearest planes first, so a pixel outside the chip is turned away after the fewest tests
  for (let a = 1; a < m; a++) {
    const n0 = P[4 * a], n1 = P[4 * a + 1], n2 = P[4 * a + 2], hh = P[4 * a + 3];
    let b = a - 1;
    while (b >= 0 && P[4 * b + 3] > hh) { for (let q = 0; q < 4; q++) P[4 * b + 4 + q] = P[4 * b + q]; b--; }
    P[4 * b + 4] = n0; P[4 * b + 5] = n1; P[4 * b + 6] = n2; P[4 * b + 7] = hh;
  }
  c.m = m;
  let bs = 1;
  if (R > RCAP) { bs = RCAP / R; for (let a = 0; a < m; a++) P[4 * a + 3] *= bs; R = RCAP; }
  c.R = R;
  c.bx0 = BB[0] * bs; c.bx1 = BB[1] * bs; c.by0 = BB[2] * bs; c.by1 = BB[3] * bs; c.bz0 = BB[4] * bs; c.bz1 = BB[5] * bs;
  // marble
  let u = rn() * PTOT, pi = 0;
  while (pi < PAL.length - 1 && u >= PAL[pi][3]) { u -= PAL[pi][3]; pi++; }
  const pal = PAL[pi];
  c.h = pal[0] + 0.022 * (rn() - 0.5) * 2;
  c.s = cl(pal[1] * (0.85 + 0.3 * rn()), 0, 1);
  c.v = pal[2] * (0.86 + 0.24 * rn());
  let wx = rn() - 0.5, wy = rn() - 0.5, wz = rn() - 0.5;
  const wl = 1 / sqrt(wx * wx + wy * wy + wz * wz + 1e-9);
  c.wx = wx * wl; c.wy = wy * wl; c.wz = wz * wl;
  c.wf = 4.5 + 4 * rn(); c.wp = TP * rn();
  let gx = rn() - 0.5, gy = rn() - 0.5, gz = rn() - 0.5;
  const gl = 1 / sqrt(gx * gx + gy * gy + gz * gz + 1e-9) / R;
  c.gx = gx * gl; c.gy = gy * gl; c.gz = gz * gl;
  return c;
}

function cellChips(st, i, j, k) {
  const key = ((k + 1048576) * 128 + (j + 64)) * 128 + (i + 64);
  let v = st.cache.get(key);
  if (v === undefined) {
    const a = mkChip(i, j, k, 0, st.seed);
    const b = mkChip(i, j, k, 1, st.seed);
    if (a) a.next = b;
    v = a || b;
    st.cache.set(key, v);
  }
  return v;
}

// ---- Lab hooks ---------------------------------------------------------------
export function setup(params) {
  const st = (params.st = {
    k: [0, 2, 0.6, 0.06], ks: [0, 2, 0.6, 0.06], init: false,
    t: 0, zd: 0,
    seed: (Math.random() * 4294967296) | 0,
    ph: [TP * Math.random(), TP * Math.random(), TP * Math.random(), TP * Math.random(), TP * Math.random(), TP * Math.random(), TP * Math.random(), TP * Math.random()],
    cache: new Map(),
    list: [], nlist: 0,
    Z: new Float32Array(N), ZX: new Float32Array(N), ZY: new Float32Array(N),
    D: new Float32Array(N), D2: new Float32Array(N), I: new Int32Array(N),
    bmin: new Float32Array(128), bmax: new Float32Array(128), cmax: new Float32Array(2048),
    sA: new Float32Array(4 * W), cA: new Float32Array(4 * W), sB: new Float32Array(4 * H), cB: new Float32Array(4 * H),
    GX: new Float32Array(W), GY: new Float32Array(H),
    S: S0 * 0.6, amp: 0, pfK: -1e9, pfN: 0,
  });
  st.zd = 40 + 200 * Math.random();
  return st;
}

function surface(st) {
  const S = st.S, t = st.t, ph = st.ph, A = st.amp, zd = st.zd;
  const { sA, cA, sB, cB, GX, GY, Z, ZX, ZY, bmin, bmax } = st;
  for (let x = 0; x < W; x++) GX[x] = (x + 0.5 - 32) / S;
  for (let y = 0; y < H; y++) GY[y] = (y + 0.5 - 64) / S;
  for (let q = 0; q < 4; q++) {
    const kx = SKX[q] * SK, ky = SKY[q] * SK, th = SW[q] * t + ph[q];
    for (let x = 0; x < W; x++) { const a = kx * GX[x]; sA[q * W + x] = sin(a); cA[q * W + x] = cos(a); }
    for (let y = 0; y < H; y++) { const b = ky * GY[y] + th; sB[q * H + y] = sin(b); cB[q * H + y] = cos(b); }
  }
  for (let b = 0; b < 128; b++) { bmin[b] = 1e9; bmax[b] = -1e9; }
  let zmin = 1e9, zmax = -1e9, sm2 = 0;
  const kx0 = SKX[0] * SK, kx1 = SKX[1] * SK, kx2 = SKX[2] * SK, kx3 = SKX[3] * SK;
  const ky0 = SKY[0] * SK, ky1 = SKY[1] * SK, ky2 = SKY[2] * SK, ky3 = SKY[3] * SK;
  const a0 = A * SA[0], a1 = A * SA[1], a2 = A * SA[2], a3 = A * SA[3];
  for (let y = 0; y < H; y++) {
    const s0 = sB[y], c0 = cB[y], s1 = sB[H + y], c1 = cB[H + y], s2 = sB[2 * H + y], c2 = cB[2 * H + y], s3 = sB[3 * H + y], c3 = cB[3 * H + y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const p0 = sA[x], q0 = cA[x], p1 = sA[W + x], q1 = cA[W + x], p2 = sA[2 * W + x], q2 = cA[2 * W + x], p3 = sA[3 * W + x], q3 = cA[3 * W + x];
      const d0 = q0 * c0 - p0 * s0, d1 = q1 * c1 - p1 * s1, d2 = q2 * c2 - p2 * s2, d3 = q3 * c3 - p3 * s3;
      const z = zd + a0 * (p0 * c0 + q0 * s0) + a1 * (p1 * c1 + q1 * s1) + a2 * (p2 * c2 + q2 * s2) + a3 * (p3 * c3 + q3 * s3);
      Z[i] = z;
      const zx = a0 * kx0 * d0 + a1 * kx1 * d1 + a2 * kx2 * d2 + a3 * kx3 * d3;
      const zy = a0 * ky0 * d0 + a1 * ky1 * d1 + a2 * ky2 * d2 + a3 * ky3 * d3;
      ZX[i] = zx; ZY[i] = zy;
      const sl = zx * zx + zy * zy;
      if (sl > sm2) sm2 = sl;
      const bi = (y >> 3) * 8 + (x >> 3);
      if (z < bmin[bi]) bmin[bi] = z;
      if (z > bmax[bi]) bmax[bi] = z;
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
  }
  st.zmin = zmin; st.zmax = zmax; st.smax = sqrt(sm2);
}

function rasterize(st) {
  const S = st.S, { Z, ZX, ZY, D, D2, I, GX, GY, bmin, bmax } = st;
  D.fill(-9); D2.fill(-9); I.fill(-1);
  // the chips the slab can reach
  const list = st.list;
  let nl = 0;
  const i0 = floor(-32 / S - RCAP), i1 = floor(32 / S + RCAP);
  const j0 = floor(-64 / S - RCAP), j1 = floor(64 / S + RCAP);
  const k0 = floor(st.zmin - RCAP), k1 = floor(st.zmax + RCAP);
  for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    for (let c = cellChips(st, i, j, k); c; c = c.next) list[nl++] = c;
  }
  st.nlist = nl;
  // the layer the surface reaches next is built a few cells a frame, so no frame pays for a whole layer
  if (st.pfK !== k1 + 1) { st.pfK = k1 + 1; st.pfN = 0; }
  const wi = i1 - i0 + 1, total = wi * (j1 - j0 + 1);
  for (let made = 0; made < 12 && st.pfN < total; st.pfN++) {
    const before = st.cache.size;
    cellChips(st, i0 + (st.pfN % wi), j0 + floor(st.pfN / wi), st.pfK);
    if (st.cache.size > before) made++;
  }
  if (st.cmax.length < nl) st.cmax = new Float32Array(nl * 2);
  const cmax = st.cmax;
  if (st.cache.size > 20000) st.cache.clear();
  // how far a pixel may lie outside a chip and still be touched by its soft edge or glow, in cells
  const deep = 2.6 * sqrt(1 + st.smax * st.smax) / S;
  const mg = 1.5 / S, zm = 0.04 + mg * st.smax, thr = 2.5 * sqrt(1 + st.smax * st.smax) / S;
  for (let ci = 0; ci < nl; ci++) {
    const c = list[ci], P = c.P, m = c.m, R = c.R + mg, R2 = R * R;
    const cx = c.cx, cy = c.cy, cz = c.cz;
    cmax[ci] = -9;
    const x0 = max(0, floor((cx + c.bx0) * S + 31.5 - 3)), x1 = min(W - 1, floor((cx + c.bx1) * S + 31.5 + 3));
    const y0 = max(0, floor((cy + c.by0) * S + 63.5 - 3)), y1 = min(H - 1, floor((cy + c.by1) * S + 63.5 + 3));
    if (x0 > x1 || y0 > y1) continue;
    // does the surface pass through the chip's height anywhere under its box
    let lo = 1e9, hi = -1e9;
    for (let by = y0 >> 3; by <= y1 >> 3; by++) for (let bx = x0 >> 3; bx <= x1 >> 3; bx++) {
      const b = by * 8 + bx;
      if (bmin[b] < lo) lo = bmin[b];
      if (bmax[b] > hi) hi = bmax[b];
    }
    const zlo = cz + c.bz0 - zm, zhi = cz + c.bz1 + zm;
    if (hi < zlo || lo > zhi) continue;
    let cm = -9;
    for (let y = y0; y <= y1; y++) {
      const dy = GY[y] - cy;
      const dy2 = dy * dy;
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        const z = Z[i];
        if (z < zlo || z > zhi) continue;
        const dx = GX[x] - cx, dz = z - cz;
        if (dx * dx + dy2 + dz * dz > R2) continue;
        // outside by more than the soft edge reaches: one plane is enough to say so
        let out = false, fm = -9, am = 0;
        for (let a = 0; a < m; a++) {
          const F = P[4 * a] * dx + P[4 * a + 1] * dy + P[4 * a + 2] * dz - P[4 * a + 3];
          if (F > thr) { out = true; break; }
          FV[a] = F;
          if (F > fm) { fm = F; am = a; }
        }
        if (out) continue;
        const zx = ZX[i], zy = ZY[i];
        let dm = 9;
        if (-fm > deep) {
          // far inside: the nearest face alone gives the distance
          const nz = P[4 * am + 2];
          const gx = P[4 * am] + nz * zx, gy = P[4 * am + 1] + nz * zy;
          dm = -fm / max(0.15, sqrt(gx * gx + gy * gy)) * S;
        } else {
          for (let a = 0; a < m; a++) {
            const nz = P[4 * a + 2];
            const gx = P[4 * a] + nz * zx, gy = P[4 * a + 1] + nz * zy;
            let gn = sqrt(gx * gx + gy * gy);
            if (gn < 0.15) gn = 0.15;
            const d = -FV[a] / gn * S;
            if (d < dm) { dm = d; if (dm < -2.5) break; }
          }
        }
        if (dm > cm) cm = dm;
        if (dm > D[i]) { D2[i] = D[i]; D[i] = dm; I[i] = ci; } else if (dm > D2[i]) D2[i] = dm;
      }
    }
    cmax[ci] = cm;
  }
}

export function update(dt, input, params) {
  const st = params.st || setup(params);
  const kv = (input && input.knobValues) || st.k;
  for (let i = 0; i < 4; i++) st.k[i] = fin(kv[i], st.k[i]);
  dt = cl(fin(dt, 0), 0, 0.25);
  if (!st.init) {
    st.init = true;
    for (let i = 0; i < 4; i++) st.ks[i] = st.k[i];
  } else {
    const a = 1 - exp(-dt / 0.15);
    for (let i = 0; i < 4; i++) st.ks[i] += (st.k[i] - st.ks[i]) * a;
  }
  const grind = cl(st.ks[1], 0, 3);
  st.t += dt;
  st.zd += dt * (0.012 + 0.08 * grind);
  st.S = S0 * cl(st.ks[2], 0.6, 1.5);
  st.amp = 1.25 * sqrt(cl(st.ks[3], 0, 1));
  surface(st);
  rasterize(st);
}

// ---- drawing -----------------------------------------------------------------
export function draw(display, params) {
  const st = params.st || setup(params);
  if (!st.init) update(0, { knobValues: st.k }, params);
  const { Z, D, D2, I, GX, GY, list, cmax } = st;
  const hue = fin(st.ks[0], 0), t = st.t, ph = st.ph;
  // the sheen: a broad pale band that crosses the polished floor
  const u0 = 70 + 95 * sin(0.083 * t + ph[4]) + 30 * sin(0.0391 * t + ph[5]);
  for (let y = 0; y < H; y++) {
    const gy = GY[y];
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const z = Z[i], gx = GX[x];
      const q = (0.55 * x + 0.83 * y - u0) / 38;
      const q1 = 1 / (1 + q * q);
      const L = 0.92 + 0.16 * q1 * q1;
      // cement
      const mott = sin(2.1 * gx - 1.3 * gy + 2.3 * z + ph[6]);
      let r = 0.1 + 0.025 * mott, g = 0.105 + 0.027 * mott, b = 0.165 + 0.04 * mott;
      const ci = I[i];
      if (ci >= 0) {
        const d = D[i];
        if (d > -2.5) {
          const c = list[ci];
          const dx = gx - c.cx, dy = gy - c.cy, dz = z - c.cz;
          const sw = c.wx * dx + c.wy * dy + c.wz * dz;
          const wv = c.wy * dx - c.wx * dy;
          const vein = sin(c.wf * sw + 2.2 * wv * wv + c.wp);
          const gr = cl(c.gx * dx + c.gy * dy + c.gz * dz, -1, 1);
          let v = c.v * (1 + 0.17 * vein + 0.16 * gr);
          let s = c.s * (1 - 0.12 * vein);
          let rim = d > 0 ? 1 - (d - 0.8) * (d - 0.8) * 1.4 : 0;
          rim = rim > 0 ? rim * rim : 0;
          v += 0.3 * rim; s *= 1 - 0.4 * rim;
          hsv(c.h + hue, cl(s, 0, 1), cl(v, 0, 1), hv);
          const d2 = D2[i];
          const sm = d2 > -0.3 ? 1 - sstep(0.05, 1.0, d - d2) : 0;
          // a chip whose section is only a few LED across is not shown yet: it fades in as it widens
          const fade = sstep(0.8, 2.4, cmax[ci]);
          const a = sstep(-0.3, 0.3, d) * (1 - 0.7 * sm) * fade;
          // a faint glow of the chip's colour in the cement round it
          const gq = 1 + d * 0.4;
          const glow = d >= 0 ? 0.16 : gq > 0 ? 0.16 * gq * gq : 0;
          const k = glow * (1 - a) * fade;
          r = r + (hv[0] * 0.5 - r) * k; g = g + (hv[1] * 0.5 - g) * k; b = b + (hv[2] * 0.5 - b) * k;
          r += (hv[0] - r) * a; g += (hv[1] - g) * a; b += (hv[2] - b) * a;
        }
      }
      display.setPixel(x, y, floor(cl(r * L, 0, 1) * 255), floor(cl(g * L, 0, 1) * 255), floor(cl(b * L, 0, 1) * 255));
    }
  }
}
