// ===== Patternflow pattern =====
// Title:   Hyperbolic Band
// Family:  space
// Idea:    The hyperbolic plane tiled by heptagons, three at every corner, drawn in the band model, where the panel's 64 columns hold the whole width of the plane: the tiling slides up the band for ever and its tiles shrink to nothing at both side edges.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the band model of the hyperbolic plane, with the Poincaré disk (Eugenio Beltrami 1868, Henri Poincaré 1882) and Coxeter's regular {p,q} tilings, pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tiling=0..4, Lines=0..1
//
// Knob 1: Hue. Turns the glass round the colour wheel. At 0 the tiles on the middle line are cyan and blue, and they go violet and then magenta out towards the edges.
// Knob 2: Speed. How fast the plane slides along the band. At 2 the tiles on the middle line climb 12 LEDs a second; at 0.2 a tenth of that.
// Knob 3: Tiling. Which regular tiling {p,q}, p-gons meeting q at a corner: heptagons three at a corner {7,3}, then octagons {8,3}, pentagons four at a corner {5,4}, squares five at a corner {4,5} and triangles seven at a corner {3,7}.
// Knob 4: Lines. At 0 dark leading between bright glass. Turned up, the leading goes pewter and then white, and the glass dims to a fifth.
// Buttons: K1 tap turns the plane half round about the edge middle nearest the panel's centre in three seconds, with the mirrors through the tile centres lit. A half turn about an edge middle is a symmetry of the tiling, so it lands back on itself.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, atan2, log, asinh, acosh, abs, tanh, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// The band |Im w| < 1 goes onto the Poincaré disk by z = tanh(pi w / 4). Here
// Im w runs across the panel, one unit to 32 LEDs, and Re w up it, so the
// middle line of the band is the disk's real diameter, a geodesic. Along it a
// unit of w is pi / 2 of hyperbolic length; at a distance v off it, a LED is
// 1 / cos(pi v / 2) times longer.
const ZX = new Float64Array(N), ZY = new Float64Array(N), RHO = new Float64Array(W);
for (let x = 0; x < W; x++) {
  const v = (x + 0.5 - W / 2) / 32;
  RHO[x] = PI / 64 / cos((PI * v) / 2);
  for (let y = 0; y < H; y++) {
    const u = (H / 2 - y - 0.5) / 32, a = (PI * u) / 2, b = (PI * v) / 2, d = Math.cosh(a) + cos(b);
    ZX[y * W + x] = Math.sinh(a) / d;
    ZY[y * W + x] = sin(b) / d;
  }
}

// The tilings. For each, the fundamental triangle of its reflection group:
// the corner at the origin (a tile's centre) with angle pi/p between the real
// axis and the ray at pi/p, and the circle mirror (the tile's edge) crossing
// the real axis square at distance a. a is the tile's inradius, R its
// circumradius, e half an edge. T is the shortest translation along the real
// axis that is a symmetry: twice the gap between the mirrors that cross the
// axis square, which depends on what the axis meets on its way.
const TIL = [[7, 3], [8, 3], [5, 4], [4, 5], [3, 7]].map(([p, q]) => {
  const a = acosh(cos(PI / q) / sin(PI / p)), R = acosh(1 / (Math.tan(PI / p) * Math.tan(PI / q))), e = acosh(cos(PI / p) / sin(PI / q));
  const m = tanh(a / 2), C = (m + 1 / m) / 2, r = (1 / m - m) / 2;
  const T = p % 2 === 0 ? 2 * a : q % 2 === 0 ? 4 * (a + R) : 2 * (a + R + e);
  const rc = new Float64Array(p), rs = new Float64Array(p);
  for (let k = 0; k < p; k++) (rc[k] = cos((2 * PI * k) / p)), (rs[k] = sin((2 * PI * k) / p));
  // The wedge number, p added, taken round to 0..p-1.
  const wr = new Int8Array(3 * p).map((_, i) => i % p);
  return { p, q, a, R, C, r, r2: r * r, Tb: (2 * T) / PI, m0: (2 * a) / PI, rc, rs, wr, sf: sin(PI / p), cf: cos(PI / p) };
});

const MAXIT = 40;
const CODE = new Int8Array(MAXIT);
let lutHue = NaN;
const LUT = new Float32Array(1024 * 3);
function hsv(h, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h);
  const rgb = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c];
}

export function setup(params) {
  params.s = { s: 0, hue: 0, til: 0, lines: 0.06, speed: 2, spin: -1, m: 0, buf: new Float32Array(N * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.til = cl(Math.round(k[2]), 0, TIL.length - 1);
  P.lines = cl(k[3], 0, 1);
  const G = TIL[P.til];
  // Tiles climb: the point of the tiling under the panel's centre moves down
  // the band. 12 LEDs a second at Speed 2.
  const slow = P.spin >= 0 ? 1 - 0.8 * sin(PI * P.spin) : 1;
  P.s -= d * P.speed * 0.1875 * slow;
  P.s -= G.Tb * floor(P.s / G.Tb + 0.5);
  if (P.spin >= 0) {
    P.spin += d / 3;
    if (P.spin >= 1) P.spin = -1;
  } else if (input.btnPressed && input.btnPressed[0]) {
    // The nearest point where a mirror crosses the axis square: the middle of
    // an edge, or for even p a tile's centre too.
    const h = G.Tb / 2;
    P.m = G.m0 + h * Math.round((P.s - G.m0) / h);
    P.spin = 0;
  }
}

// Complex 2x2 Möbius matrices as [ar, ai, br, bi, cr, ci, dr, di].
function mul(A, B) {
  const o = [];
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const p = A[i * 4], pi = A[i * 4 + 1], q = A[i * 4 + 2], qi = A[i * 4 + 3];
      const u = B[j * 2], ui = B[j * 2 + 1], v = B[4 + j * 2], vi = B[5 + j * 2];
      o.push(p * u - pi * ui + q * v - qi * vi, p * ui + pi * u + q * vi + qi * v);
    }
  return o;
}
const trans = (wb) => {
  const t = tanh((PI * wb) / 4);
  return [1, 0, t, 0, t, 0, 1, 0];
};
const rot = (th) => [cos(th / 2), sin(th / 2), 0, 0, 0, 0, cos(th / 2), -sin(th / 2)];

// The colour of a point of the tiling from where it sits on the band: cyan
// glass on the middle line going through blue and violet to magenta at the
// edges, and swinging a little along the band with the period T. Both are
// kept by the half turn of K1 about any point where a mirror crosses the axis
// square, and by the slide of one period.
function hueAt(G, x, y) {
  const u = (1 / PI) * log(((1 + x) ** 2 + y * y) / ((1 - x) ** 2 + y * y)), v = (2 / PI) * atan2(2 * y, 1 - x * x - y * y);
  const h = 0.5 + 0.06 * cos((2 * PI * (u - G.m0)) / G.Tb) + 0.3 * sqrt(abs(v));
  return (((h - floor(h)) * 1024) | 0) * 3;
}

// atan2 to a hundred-thousandth of a radian, which is all the fold needs to
// pick its wedge: a point that lands a hair across a straight mirror is on
// that mirror either way.
function fat(y, x) {
  const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y, a = (ax < ay ? ax : ay) / ((ax < ay ? ay : ax) + 1e-300), q = a * a;
  let r = ((-0.0464964749 * q + 0.15931422) * q - 0.327622764) * q * a + a;
  if (ay > ax) r = PI / 2 - r;
  if (x < 0) r = PI - r;
  return y < 0 ? -r : r;
}

const PREV = new Int8Array(MAXIT);
export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const G = TIL[P.til], { p, C, r, r2, rc, rs, sf, cf, wr, a: ina, R: circ } = G, pp = p / PI;
  const buf = P.buf, L = P.lines;
  // From the panel's disk to the tiling: slide s along the axis, and during
  // the K1 half turn, turn by th about the crossing m on the way.
  let M = trans(P.s), mir = 0;
  if (P.spin >= 0) {
    const u = P.spin, th = PI * u * u * (3 - 2 * u);
    M = mul(trans(P.m), mul(rot(th), trans(P.s - P.m)));
    mir = sin(PI * u);
  }
  const [ar, ai, br, bi, cr, ci, dr, di] = M;
  if (lutHue !== P.hue) for (let i = 0; i < 1024; i++) hsv(i / 1024 + (lutHue = P.hue), LUT, i * 3);
  const glassV = 1 - 0.78 * L, haze = 0.62 * glassV + 0.12 * L;
  const lineR = 255 * L, lineG = 245 * L, lineB = 225 * L;
  // The leading and the mirrors are lines of fixed hyperbolic width, box
  // filtered over the LED, so they thin out with the tiles.
  const hw = 0.035, mw = 0.025;
  // The haze comes in as a tile's inradius drops from about three LEDs to one.
  for (let x = 0; x < W; x++) {
    const rho = RHO[x], fog = sm(0.3 * ina, 1.1 * ina, rho);
    let pn = -1, po = 0;
    for (let y = 0; y < H; y++) {
      const i = y * W + x, zx = ZX[i], zy = ZY[i];
      const nx = ar * zx - ai * zy + br, ny = ar * zy + ai * zx + bi;
      const dx = cr * zx - ci * zy + dr, dy = cr * zy + ci * zx + di;
      const qd = 1 / (dx * dx + dy * dy);
      let X = (nx * dx + ny * dy) * qd, Y = (ny * dx - nx * dy) * qd;
      let R = 0, Gc = 0, B = 0;
      // Where the tiles are smaller than a LED, the glass's average colour.
      if (fog > 0) {
        const o = hueAt(G, X, Y);
        R = LUT[o] * 255 * haze;
        Gc = LUT[o + 1] * 255 * haze;
        B = LUT[o + 2] * 255 * haze;
      }
      if (fog < 1) {
        // Fold into the fundamental triangle: turn into the wedge of angle
        // pi/p, then reflect in the edge circle, until the edge is not crossed.
        // Each turn and whether it flipped is kept, to find the tile's centre.
        let n = 0, par = 0, ok = 1;
        for (;;) {
          const m = floor(fat(Y, X) * pp), f = m & 1, jj = wr[((m + 1) >> 1) + p];
          const c = rc[jj], s = rs[jj], X1 = X * c + Y * s;
          Y = Y * c - X * s;
          X = X1;
          if (f) Y = -Y;
          par ^= f;
          const ex = X - C, e2 = ex * ex + Y * Y;
          if (e2 >= r2) break;
          if (n >= MAXIT) {
            ok = 0;
            break;
          }
          CODE[n++] = jj * 2 + f;
          const g = r2 / e2;
          X = C + ex * g;
          Y *= g;
          par ^= 1;
        }
        if (!ok) {
          const o = hueAt(G, X, Y);
          (R = LUT[o] * 255 * haze), (Gc = LUT[o + 1] * 255 * haze), (B = LUT[o + 2] * 255 * haze);
        } else {
          // The same steps as the LED above: the same tile.
          let same = n === pn;
          for (let k = 0; same && k < n; k++) same = CODE[k] === PREV[k];
          if (!same) {
            // The tile's centre is the origin taken back through the steps.
            let cx = 0, cy = 0;
            if (n > 0) {
              cx = 1 / C;
              for (let k = n - 1; k >= 0; k--) {
                const jj = CODE[k] >> 1;
                if (CODE[k] & 1) cy = -cy;
                const c = rc[jj], s = rs[jj], x1 = cx * c - cy * s;
                cy = cx * s + cy * c;
                cx = x1;
                if (k > 0) {
                  const ex = cx - C, e2 = ex * ex + cy * cy, g = r2 / e2;
                  cx = C + ex * g;
                  cy *= g;
                }
              }
            }
            po = hueAt(G, cx, cy);
            pn = n;
            for (let k = 0; k < n; k++) PREV[k] = CODE[k];
          }
          // Distances in the triangle: to the tile's edge, its centre, and the
          // two straight mirrors that cut the tile into 2p facets.
          const z2 = X * X + Y * Y, den = 1 - z2, zr = sqrt(z2);
          const de = asinh((1 + z2 - 2 * C * X) / (r * den)), dc = log((1 + zr) / (1 - zr));
          const dm = min(2 * Y, 2 * (X * sf - Y * cf)) / den;
          const facet = 1 + (par ? -0.09 : 0.09) * min(1, dm / rho);
          const gl = (1 - 0.42 * (dc / circ) ** 2) * facet * glassV * 255;
          let r0 = LUT[po] * gl, g0 = LUT[po + 1] * gl, b0 = LUT[po + 2] * gl;
          const cov = cl((min(de + rho / 2, hw) - max(de - rho / 2, -hw)) / rho, 0, 1);
          r0 += (lineR - r0) * cov;
          g0 += (lineG - g0) * cov;
          b0 += (lineB - b0) * cov;
          if (mir > 0) {
            const mc = cl((min(dm + rho / 2, mw) - max(dm - rho / 2, -mw)) / rho, 0, 1) * mir * 0.85;
            r0 += (250 - r0) * mc;
            g0 += (235 - g0) * mc;
            b0 += (200 - b0) * mc;
          }
          R = R * fog + r0 * (1 - fog);
          Gc = Gc * fog + g0 * (1 - fog);
          B = B * fog + b0 * (1 - fog);
        }
      }
      const q = i * 3;
      buf[q] = R;
      buf[q + 1] = Gc;
      buf[q + 2] = B;
    }
  }
  for (let q = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, buf[q], buf[q + 1], buf[q + 2]);
}
