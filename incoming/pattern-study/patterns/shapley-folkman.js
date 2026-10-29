// ===== Patternflow pattern =====
// Title:   Shapley-Folkman
// Family:  geometry
// Idea:    Four bands down the panel hold one nonconvex shape and its Minkowski averages of 2, 4 and 8 copies, each summed exactly on a lattice, so its bays and holes close band by band toward the convex hull drawn faintly round it, the distance still to go halving at every band and every point coloured by the band where it first appears.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Shapley-Folkman lemma (Lloyd Shapley and Jon Folkman, first published by Ross Starr, 1969), pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..4, Hull=0..1
//
// Knob 1: Hue. Turns the four layer colours round a wheel that skips orange. At 0 the shape is teal and the parts added at 2, 4 and 8 copies azure, indigo and violet; at 0.25 blue, violet, magenta and yellow; at 0.75 lime, green, cyan and azure. The uncovered part of the hull is gold at 0 and turns with them.
// Knob 2: Speed. How fast the shape moves: at 2 the moon's bite, the pearls and the ring's gap go round in 9 s, the star turns one point in 1.8 s and the comb's teeth rise and fall every 6.9 s; at 0.2 ten times slower, at 3 two thirds of that. Every band follows at once, since all four are summed again each frame.
// Knob 3: Shape. 0 a moon (an ellipse with a bite), 1 three pearls, 2 an open ring, 3 a comb, 4 a five-pointed star; in between, the two neighbours blend and break into pieces. At 1 copy they leave 43, 51, 45, 37 and 45% of their hull uncovered, at 8 copies 3.7, 1.3, 0.7, 0.9 and 4.4%.
// Knob 4: Hull. The convex hull is a faint line at 0 and 0.06; toward 1 the line brightens and the part of the hull each band has not yet covered fills with gold, which is the gap the lemma says shrinks like 1/n.

// The Shapley-Folkman lemma: in the plane, a point of the convex hull of a
// sum of n sets is a sum of n points, one from each set, of which at most
// two come from a set's hull instead of the set. So the average of n copies
// of a shape S, A(n) = (S + ... + S) / n, comes within 2D/n of every point
// of S's hull, where D is how far the hull reaches from S itself: the
// average fills toward the hull like 1/n. A(1), A(2), A(4) and A(8) also
// nest, since (a + b) / 2 = (a + a + b + b) / 4.
//
// The panel takes S as the lattice points, one per LED, inside the shape,
// sums the point sets exactly (8 copies make a lattice of 465 by 217),
// and lights each LED by the share of A(n)'s points that fall inside it.
// Brightness is never how many ways a point can be reached: that count is
// the bell of the central limit theorem, a different statement.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, cos, sin, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// One band per n. The shape's lattice is SW by SH points, one per LED,
// placed at (X0, Y0) inside each 32-row band.
const NS = [1, 2, 4, 8], NMAX = 8;
const SW = 59, SH = 28, X0 = 4, Y0 = 2, BAND = 32;
const CX = (SW - 1) / 2, CY = (SH - 1) / 2;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- Lattice sets as bitmaps: w by h points, rows of 32-bit words. ----
function bitmap(w, h) {
  const ww = ((w + 31) >> 5) + 1;
  return { w, h, ww, b: new Uint32Array(ww * h) };
}
const has = (B, x, y) => (B.b[y * B.ww + (x >> 5)] >>> (x & 31)) & 1;

// dst |= src moved by (dx, dy).
function orShift(dst, src, dx, dy) {
  const q = dx >> 5, r = dx & 31, sw = src.ww, dw = dst.ww, sb = src.b, db = dst.b;
  const used = (src.w + 31) >> 5;
  for (let y = 0; y < src.h; y++) {
    const so = y * sw, d0 = (y + dy) * dw + q;
    if (r === 0) for (let i = 0; i < used; i++) db[d0 + i] |= sb[so + i];
    else
      for (let i = 0; i < used; i++) {
        const v = sb[so + i];
        if (!v) continue;
        db[d0 + i] |= v << r;
        db[d0 + i + 1] |= v >>> (32 - r);
      }
  }
}

// The points of B with one of their eight neighbours outside B.
function boundary(B, xs, ys) {
  const { h, ww, b } = B, used = (B.w + 31) >> 5;
  const hor = (o, i) => {
    const m = b[o + i];
    if (!m) return 0;
    return m & ((m << 1) | (i > 0 ? b[o + i - 1] >>> 31 : 0)) & ((m >>> 1) | (i + 1 < used ? b[o + i + 1] << 31 : 0));
  };
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let i = 0; i < used; i++) {
      const m = b[y * ww + i];
      if (!m) continue;
      const inner = y > 0 && y < h - 1 ? hor(y * ww, i) & hor((y - 1) * ww, i) & hor((y + 1) * ww, i) : 0;
      let e = m & ~inner;
      while (e) {
        const t = e & -e;
        xs[n] = i * 32 + 31 - Math.clz32(t);
        ys[n++] = y;
        e ^= t;
      }
    }
  return n;
}

// One point from each 8-connected piece of S.
function pieces(S, lab, stack, out) {
  out.length = 0;
  lab.fill(0);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (lab[y * SW + x] || !has(S, x, y)) continue;
      out.push(x, y);
      let sp = 0;
      stack[sp++] = y * SW + x;
      lab[y * SW + x] = 1;
      while (sp) {
        const p = stack[--sp], px = p % SW, py = (p - px) / SW;
        for (let yy = max(0, py - 1); yy <= min(SH - 1, py + 1); yy++)
          for (let xx = max(0, px - 1); xx <= min(SW - 1, px + 1); xx++) {
            const k = yy * SW + xx;
            if (!lab[k] && has(S, xx, yy)) (lab[k] = 1), (stack[sp++] = k);
          }
      }
    }
}

// C = A + S, the Minkowski sum of lattice sets. Shifting the small S to
// every point of A would do; it is enough to shift it to the boundary
// points of A, and add one copy of A for each piece of S. For a piece P of
// S and a sum x = p + a, the set x - P is connected and holds a; either it
// leaves A, and then it crosses A's boundary, or it stays inside A and
// x lies in A shifted by any one point of P. S is at most 64 points wide,
// so each of its rows, moved by 0 to 31 bits, is kept ready as three words.
function sum(C, A, St, reps, xs, ys) {
  const cb = C.b, cw = C.ww, pre = St.pre, y0 = St.ylo, y1 = St.yhi;
  cb.fill(0);
  const n = boundary(A, xs, ys);
  for (let k = 0; k < n; k++) {
    const x = xs[k], p0 = (x & 31) * SH * 3;
    let o = (ys[k] + y0) * cw + (x >> 5);
    for (let y = y0, p = p0 + y0 * 3; y <= y1; y++, p += 3, o += cw) {
      cb[o] |= pre[p];
      cb[o + 1] |= pre[p + 1];
      cb[o + 2] |= pre[p + 2];
    }
  }
  for (let k = 0; k < reps.length; k += 2) orShift(C, A, reps[k], reps[k + 1]);
}

// ---- The shapes, as rough signed distances in LEDs (inside < 0). ----
// The lattice is 59 wide and 28 tall; U and V scale a unit circle to it.
const U = 28.5, V = 13;
const len = (x, y) => sqrt(x * x + y * y);
const SHAPES = [
  // Moon: an ellipse with a bite out of it, the bite going round.
  (x, y, p) => {
    const u = x / U, v = y / V, bu = u - 0.45 * cos(p), bv = v - 0.45 * sin(p);
    return max(len(u, v) - 1, 0.75 - len(bu, bv)) * V;
  },
  // Pearls: three discs going round an ellipse.
  (x, y, p) => {
    let d = 1e9;
    for (let j = 0; j < 3; j++) {
      const a = p + (TAU * j) / 3;
      d = min(d, len(x - 21 * cos(a), y - 6.5 * sin(a)) - 6.5);
    }
    return d;
  },
  // Open ring: an elliptic band with a gap going round.
  (x, y, p) => {
    const u = x / U, v = y / V, r = len(u, v);
    const a = atan2(v, u) - p, g = abs(atan2(sin(a), cos(a)));
    return max(abs(r - 0.8) - 0.2, (0.55 - g) * r) * V;
  },
  // Comb: a back along the bottom and four teeth rising and falling.
  (x, y, p) => {
    let d = max(abs(x) - 28.5, abs(y - 10.5) - 3);
    for (let j = 0; j < 4; j++) {
      const tx = -21.4 + 14.25 * j, top = -13 + 7 * (0.5 + 0.5 * sin(p * 1.3 + j * 1.9));
      d = min(d, max(abs(x - tx) - 3.2, max(top - y, y - 10)));
    }
    return d;
  },
  // Star: five points turning, seen flattened to fit the band.
  (x, y, p) => {
    const u = x / U, v = y / V, r = len(u, v);
    const a = atan2(v, u) - p, k = (a * 5) / TAU, f = abs(k - floor(k) - 0.5) * 2;
    return (r - (0.38 + 0.62 * f * f)) * V * 1.4;
  },
];

export function setup(params) {
  const sums = [null];
  for (let k = 1; k <= NMAX; k++) sums.push(bitmap(k * (SW - 1) + 1, k * (SH - 1) + 1));
  const big = sums[NMAX - 1].w * sums[NMAX - 1].h;
  params.s = {
    t: 0, phase: 0, hue: 0, shape: 0, hk: 0.06,
    sums, xs: new Int32Array(big), ys: new Int32Array(big),
    lab: new Uint8Array(SW * SH), stack: new Int32Array(SW * SH * 9), reps: [],
    cov: new Float32Array(NS.length * SW * SH), sd: new Float32Array(SW * SH),
    hull: [], pre: new Uint32Array(32 * SH * 3), ylo: 0, yhi: -1, ex: new Float64Array(SW * SH * 3),
    pop: new Uint8Array(256).map((_, i) => (i.toString(2).match(/1/g) || []).length),
    c: new Float32Array(3), lay: new Float32Array(NS.length * 9), unc: new Float32Array(SW * SH), rgb: new Float32Array(W * H * 3),
  };
  return params.s;
}

// Rasterise the shape at this phase and knob, then the sums 2..8.
function build(S) {
  const A = S.sums[1];
  A.b.fill(0);
  const k = cl(S.shape, 0, 4), i0 = min(3, floor(k)), f = k - i0;
  const fa = SHAPES[i0], fb = SHAPES[i0 + 1];
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const px = x - CX, py = y - CY;
      let d = fa(px, py, S.phase);
      if (f > 0) d = d * (1 - f) + fb(px, py, S.phase) * f;
      if (d <= 0) A.b[y * A.ww + (x >> 5)] |= 1 << (x & 31);
    }
  pieces(A, S.lab, S.stack, S.reps);
  S.ylo = SH;
  S.yhi = -1;
  for (let y = 0; y < SH; y++) {
    const w0 = A.b[y * A.ww], w1 = A.b[y * A.ww + 1];
    if (w0 | w1) (S.ylo = min(S.ylo, y)), (S.yhi = y);
    for (let r = 0; r < 32; r++) {
      const p = (r * SH + y) * 3;
      S.pre[p] = w0 << r;
      S.pre[p + 1] = r ? (w0 >>> (32 - r)) | (w1 << r) : w1;
      S.pre[p + 2] = r ? w1 >>> (32 - r) : 0;
    }
  }
  for (let n = 1; n < NMAX; n++) sum(S.sums[n + 1], S.sums[n], S, S.reps, S.xs, S.ys);
  hullOf(S);
  // Coverage of each LED: the share of the n by n lattice points of the
  // n-fold sum that fall in it, since A(n) is that sum shrunk by 1/n.
  for (let bi = 0; bi < NS.length; bi++) {
    const n = NS[bi], B = S.sums[n], o = bi * SW * SH, h = n >> 1, mask = (1 << n) - 1;
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        let c = 0;
        const a = n * x - h;
        for (let r = n * y - h; r < n * y - h + n; r++) {
          if (r < 0 || r >= B.h) continue;
          const row = r * B.ww;
          if (a < 0) {
            c += S.pop[B.b[row] & ((1 << (a + n)) - 1)];
            continue;
          }
          const wi = a >> 5, off = a & 31;
          let v = B.b[row + wi] >>> off;
          if (off + n > 32) v |= B.b[row + wi + 1] << (32 - off);
          c += S.pop[v & mask];
        }
        S.cov[o + y * SW + x] = c / (n * n);
      }
  }
}

// Convex hull of the shape's lattice points (monotone chain), then each
// LED's signed distance to it, negative inside.
function hullOf(S) {
  const n = boundary(S.sums[1], S.xs, S.ys), P = [];
  for (let k = 0; k < n; k++) P.push([S.xs[k], S.ys[k]]);
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  const Hl = lo.slice(0, -1).concat(up.slice(0, -1));
  S.hull = Hl;
  // The chain turns left at every corner, reading y as up, so the inside
  // is on the left of each edge; an LED's distance is the largest it lies
  // outside any edge, which is exact inside and close enough near it.
  const m = Hl.length, E = S.ex;
  for (let i = 0; i < m; i++) {
    const a = Hl[i], b = Hl[(i + 1) % m], ex = b[0] - a[0], ey = b[1] - a[1], L = sqrt(ex * ex + ey * ey) || 1;
    E[i * 3] = ey / L;
    E[i * 3 + 1] = -ex / L;
    E[i * 3 + 2] = (a[1] * ex - a[0] * ey) / L;
  }
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      let d = -1e9;
      for (let i = 0; i < m * 3; i += 3) d = max(d, x * E[i] + y * E[i + 1] + E[i + 2]);
      S.sd[y * SW + x] = m < 3 ? 9 : d;
    }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1] ?? 2, 0.2, 3);
  S.shape = cl(kv[2] || 0, 0, 4);
  S.hk = cl(kv[3] ?? 0.06, 0, 1);
  S.t += d;
  S.phase += d * speed * 0.35;
  build(S);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, c = S.c, L = S.lay, unc = S.unc, cov = S.cov, A = SW * SH;
  rgb.fill(0);
  const hk = S.hk;
  // Colour by n: each band's points are coloured by the band where they
  // first appear, since A(1), A(2), A(4) and A(8) each hold the one before.
  // Older layers are deep, the layer new in this band is pale and bright.
  // The wheel skips orange, which goes brown at the depth of the old
  // layers: the knob runs from yellow through green, blue and violet to red.
  const wheel = (p) => 0.16 + (p - floor(p)) * 0.84;
  for (let j = 0; j < NS.length; j++) {
    const h = wheel(S.hue + 0.352 + 0.136 * j);
    hsv(h, 0.88, 0.58, c);
    L.set(c, j * 9);
    hsv(h + 0.03, 0.45, 1, c);
    L.set(c, j * 9 + 3);
    hsv(h, 0.9, 0.85, c);
    L.set(c, j * 9 + 6);
  }
  hsv(S.hue + 0.13, 0.8, 1, c);
  const fr = c[0], fg = c[1], fb = c[2];
  for (let bi = 0; bi < NS.length; bi++) {
    const n = NS[bi], o = bi * A;
    for (let k = 0; k < A; k++) unc[k] = cl(0.5 - S.sd[k], 0, 1) * (1 - cov[o + k]);
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const k = y * SW + x, cv = cov[o + k], sd = S.sd[k];
        let r = 0, g = 0, b = 0, acc = 0;
        for (let j = 0; j <= bi; j++) {
          const cj = min(cov[j * A + k], cv), lj = cj - acc;
          if (lj <= 0) continue;
          acc = cj;
          const q = j * 9 + (bi === 0 ? 6 : j === bi ? 3 : 0);
          r += L[q] * lj;
          g += L[q + 1] * lj;
          b += L[q + 2] * lj;
        }
        // The filling edge: lit points next to the part of the hull still
        // uncovered glow in the new layer's pale colour.
        let u = 0;
        if (cv > 0) {
          if (x > 0) u = max(u, unc[k - 1]);
          if (x < SW - 1) u = max(u, unc[k + 1]);
          if (y > 0) u = max(u, unc[k - SW]);
          if (y < SH - 1) u = max(u, unc[k + SW]);
        }
        const glow = u * cv * 0.7, gq = bi * 9 + 3;
        const line = cl(1 - abs(sd) / 0.8, 0, 1) * (0.14 + 0.5 * hk);
        const gap = unc[k] * hk * 0.85;
        const q = ((bi * BAND + Y0 + y) * W + X0 + x) * 3;
        rgb[q] = r + L[gq] * glow + fr * gap + line * 0.8;
        rgb[q + 1] = g + L[gq + 1] * glow + fg * gap + line * 0.75;
        rgb[q + 2] = b + L[gq + 2] * glow + fb * gap + line * 0.6;
      }
    // n dots at the left edge: the number of copies summed.
    for (let j = 0; j < n; j++) {
      const Y = bi * BAND + 16 - ((n - 1) * 3) / 2 + j * 3;
      const q = ((Y | 0) * W + 1) * 3;
      rgb[q] = L[bi * 9 + 3];
      rgb[q + 1] = L[bi * 9 + 4];
      rgb[q + 2] = L[bi * 9 + 5];
    }
  }
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      const q = (Y * W + X) * 3;
      display.setPixel(X, Y, min(255, rgb[q] * 255) | 0, min(255, rgb[q + 1] * 255) | 0, min(255, rgb[q + 2] * 255) | 0);
    }
}
