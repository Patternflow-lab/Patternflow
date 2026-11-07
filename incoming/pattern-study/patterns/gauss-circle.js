// ===== Patternflow pattern =====
// Title:   Gauss Circle
// Family:  number
// Idea:    A circle of radius r grows over the integer lattice, each lattice point it swallows flashing as it goes in, while below it a trace draws the error E(r) = N(r) - pi r^2 between the number of points inside and the area, a sawtooth that jumps up at every sum of two squares and slopes down between, and stays in a band about as wide as the square root of r instead of growing with r.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gauss circle problem (Carl Friedrich Gauss, 1801), the jump of its error at each sum of two squares n being Jacobi's two-square theorem r2(n) = 4 (d1(n) - d3(n)) (Carl Jacobi, 1829); pattern round 109
// Round:   109
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Norm=-1..3, Tilt=0..45
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the points inside the ball are cyan, the points still outside violet, the ring and the trace gold and the band round the trace blue.
// Knob 2: Speed. How fast the radius grows. At 2 it grows 1.5 a second: the first four points go in at 0.67 s, 29 are in by 2 s, and r reaches 30 at 20 s, after which the picture holds 3.2 s, fades and starts again. 0.5 is four times slower and 4 is twice as fast.
// Knob 3: Norm. The shape of the ball that is counted, |x|^p + |y|^p <= r^p. It catches at -1 (p = 1, a diamond), 0 (p = 2, the circle, where it opens), 1 (p = 4), 2 (p = 8) and 3 (a square), and between the catches the ball is drawn smoothly, p doubling for each step up to 2 and then rising to the square. The trace is the error of the count for that ball: for the circle it keeps near the band, for the diamond and the square it grows like r.
// Knob 4: Tilt. Turns the lattice, not the ball, from 0 to 45 degrees about the centre. A circle counts the same on a lattice turned about its centre, so for the circle the points turn and the trace does not move. For any other ball the count changes: the square's trace, out of the band and as large as 121 at 0 degrees, is back inside it at about 31 degrees.

const W = 64, H = 128, NPX = 64 * 64;
const CX = 32, CY = 32; // the lattice origin, the corner shared by four LEDs
const ZERO = 96; // the row between rows 95 and 96, where E = 0
const R_MAX = 30, V = 1.5; // the run ends at radius 30; radius grows V a clock unit
const HOLD = 3.2, FADE = 1, REST = 0.4;
const T_RUN = R_MAX / V, T_END = T_RUN + HOLD + FADE + REST;
const X0 = 5; // the trace starts with 5 units of r across the width, and the axis opens out from there
const KMAX = 44; // lattice indices counted: every point with norm <= 30 in any of the balls
const RAMP = 1.6; // how bright the slope between jumps is drawn against a jump
const { floor, ceil, round, min, max, abs, sqrt, pow, exp, sin, cos, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are made lighter and paler.
function tint(h, s, v, out) {
  const hh = h - floor(h);
  if (hh > 0.02 && hh < 0.2) {
    v = 0.4 + 0.6 * v;
    s *= 0.7;
  }
  hsv(hh, s, v, out);
}

// The Gamma function, Lanczos' approximation with g = 7, for the area of the
// ball |x|^p + |y|^p <= 1: (2 Gamma(1 + 1/p))^2 / Gamma(1 + 2/p), which is 2
// for p = 1, pi for p = 2 and 4 for the square.
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function gamma(z) {
  z -= 1;
  let x = LG[0];
  for (let i = 1; i < 9; i++) x += LG[i] / (z + i);
  const t = z + 7.5;
  return sqrt(2 * PI) * pow(t, z + 0.5) * exp(-t) * x;
}
const areaOf = (p, inf) => (inf ? 4 : pow(2 * gamma(1 + 1 / p), 2) / gamma(1 + 2 / p));

// The norm of lattice point (i, j) after the lattice is turned by an angle
// whose cosine and sine are c and s. For p = 2 the turn changes nothing, so the
// integers are used as they are and equal norms stay exactly equal.
function normOf(i, j, p, inf, c, s) {
  if (p === 2) return sqrt(i * i + j * j);
  const x = abs(i * c - j * s), y = abs(i * s + j * c);
  if (inf) return max(x, y);
  if (p === 1) return x + y;
  return pow(pow(x, p) + pow(y, p), 1 / p);
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, q: 0, p: 2, inf: false, tilt: 0, area: PI, tau: 0, cycle: 0, ys: 8,
    pk: -9, tk: -9,
    vals: new Float64Array((2 * KMAX + 1) * (2 * KMAX + 1)),
    gr: new Float64Array(4096), gc: new Int32Array(4096), gn: new Int32Array(4096), ng: 0,
    heat: new Float32Array(NPX), jc: new Int32Array(64), buf: new Float32Array(W * H * 3),
  };
  build(params.s);
}

// Every lattice point with norm <= 30, sorted, then made into groups of equal
// norm: the radius where the count jumps, how many points jump there, and the
// count after the jump. A turned lattice keeps its fourfold symmetry, so
// groups come in fours; for the circle they are the representations r2(n).
function build(S) {
  const c = cos(S.tilt), s = sin(S.tilt), v = S.vals;
  let n = 0;
  for (let i = -KMAX; i <= KMAX; i++)
    for (let j = -KMAX; j <= KMAX; j++) {
      const nu = normOf(i, j, S.p, S.inf, c, s);
      if (nu <= R_MAX + 1e-9) v[n++] = nu;
    }
  const a = v.subarray(0, n);
  a.sort();
  let g = 0;
  for (let k = 0; k < n; ) {
    let m = k;
    while (m + 1 < n && a[m + 1] - a[k] < 1e-9) m++;
    S.gr[g] = a[k];
    S.gc[g] = m - k + 1;
    S.gn[g] = m + 1;
    g++;
    k = m + 1;
  }
  S.ng = g;
  S.pk = S.p;
  S.tk = S.tilt;
}

// The count N(r) of points with norm <= r: the groups up to r.
function countAt(S, r) {
  let lo = 0, hi = S.ng;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (S.gr[m] <= r) lo = m + 1;
    else hi = m;
  }
  return lo === 0 ? 0 : S.gn[lo - 1];
}

// The knob catches at whole numbers: 0.14 either side of one stays on it.
function catchAt(q) {
  const c = round(q), d = q - c, w = 0.14;
  return abs(d) <= w ? c : c + (d < 0 ? -1 : 1) * (abs(d) - w) * (0.5 / (0.5 - w));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.5, 4);
  S.q = catchAt(cl(k[2], -1, 3));
  S.p = S.q <= 2 ? pow(2, S.q + 1) : 8 / (3 - S.q);
  S.inf = S.p >= 64;
  if (S.inf) S.p = 64;
  if (S.q === 0) S.p = 2;
  S.tilt = (cl(k[3], 0, 45) * PI) / 180;
  S.area = areaOf(S.p, S.inf);
  if (abs(S.p - S.pk) > 1e-9 || abs(S.tilt - S.tk) > 1e-9) build(S);
  S.tau += d * (S.speed / 2);
  if (S.tau > T_END) {
    S.cycle++;
    S.tau = 0;
  }
  // The vertical scale of the trace follows the largest |E| it has had so far:
  // it opens out at once when the trace needs room and closes in slowly.
  const r = min(R_MAX, V * S.tau);
  let M = 0;
  for (let g = 0; g < S.ng && S.gr[g] <= r; g++) {
    const rr = S.area * S.gr[g] * S.gr[g];
    M = max(M, abs(S.gn[g] - S.gc[g] - rr), abs(S.gn[g] - rr));
  }
  const target = cl(28 / max(3.2, 1.1 * M), 0.1, 7);
  const rate = target < S.ys ? 14 : 1.6;
  S.ys += (target - S.ys) * (1 - exp(-rate * d));
  if (S.tau < 0.02) S.ys = target;
}

// Adds weight w to the rows a vertical stroke from row ya to row yb crosses
// in column x of the trace.
function stroke(S, x, ya, yb, w) {
  if (x < 0 || x > 63) return;
  let r0 = floor(min(ya, yb)), r1 = floor(max(ya, yb));
  r0 = max(r0, 1);
  r1 = min(r1, 63);
  for (let y = r0; y <= r1; y++) S.heat[y * 64 + x] += w;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  const tau = S.tau, r = min(R_MAX, V * tau), p = S.p, inf = S.inf, A = S.area;
  const c = cos(S.tilt), sn = sin(S.tilt);
  const gm = 1 - sm((tau - (T_RUN + HOLD)) / FADE);
  const cIn = [0, 0, 0], cOut = [0, 0, 0], cGold = [0, 0, 0], cTeal = [0, 0, 0], tmp = [0, 0, 0];
  const h0 = S.hue + 0.5;
  tint(h0, 0.85, 1, cIn);
  tint(h0 + 0.3, 0.9, 0.42, cOut);
  hsv(h0 - 0.37, 0.7, 1, cGold);
  tint(h0 + 0.05, 0.9, 0.62, cTeal);

  // ---- the lattice and the ball, the top 64 rows ----
  const sc = min(8, 29.6 / max(r, 0.01)); // LEDs to a lattice unit
  const rs = r * sc; // the radius on the panel
  const rd = cl(0.28 * sc, 0.62, 2.2); // the dot's radius
  const K = ceil(46 / sc) + 1;
  const put = (x, y, rr, gg, bb) => {
    if (x < 0 || x > 63 || y < 0 || y > 63) return;
    const o = (y * W + x) * 3;
    if (rr > buf[o]) buf[o] = rr;
    if (gg > buf[o + 1]) buf[o + 1] = gg;
    if (bb > buf[o + 2]) buf[o + 2] = bb;
  };
  for (let i = -K; i <= K; i++)
    for (let j = -K; j <= K; j++) {
      let px = CX + sc * (i * c - j * sn), py = CY + sc * (i * sn + j * c);
      if (px < -4 || px > 68 || py < -4 || py > 68) continue;
      // Below 4 LEDs to a unit a dot sits on an LED, so the lattice slips
      // a column now and then as it does on a real raster, and no dot is a
      // blur of four.
      if (sc < 4) {
        px = floor(px) + 0.5;
        py = floor(py) + 0.5;
      }
      const nu = normOf(i, j, p, inf, c, sn);
      const inside = nu <= r + 1e-9;
      const age = inside ? (r - nu) / V : 9;
      const f = age < 0.45 ? 1 - age / 0.45 : 0;
      let cr, cg, cb, rad = rd;
      if (inside) {
        cr = cIn[0];
        cg = cIn[1];
        cb = cIn[2];
        if (f > 0) {
          const w = f * f;
          cr += (1 - cr) * w;
          cg += (1 - cg) * w;
          cb += (1 - cb) * w;
          rad += 1.6 * f;
        }
      } else {
        cr = cOut[0];
        cg = cOut[1];
        cb = cOut[2];
      }
      const x0 = floor(px - rad - 1), x1 = ceil(px + rad + 1), y0 = floor(py - rad - 1), y1 = ceil(py + rad + 1);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - px, dy = y + 0.5 - py;
          const a = cl(rad + 0.5 - sqrt(dx * dx + dy * dy), 0, 1);
          if (a > 0) put(x, y, cr * a, cg * a, cb * a);
        }
    }
  // The ring: where the norm of the point on the panel equals the radius,
  // seen at a distance of about one LED, and drawn along the true edge of
  // the ball whatever its shape.
  if (rs > 0.3) {
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const ax = abs(x + 0.5 - CX), ay = abs(y + 0.5 - CY);
        let rho, gr;
        if (inf) {
          rho = max(ax, ay);
          gr = 1;
        } else if (p === 1) {
          rho = ax + ay;
          gr = 1.4142;
        } else {
          rho = pow(pow(ax, p) + pow(ay, p), 1 / p);
          if (rho < 1e-6) continue;
          const u = ax / rho, w = ay / rho;
          gr = sqrt(pow(u, 2 * p - 2) + pow(w, 2 * p - 2));
        }
        const dist = abs(rho - rs) / gr;
        const a = 1 - sm((dist - 0.45) / 0.75);
        if (a > 0) put(x, y, (cGold[0] * 0.8 + 0.2) * a, (cGold[1] * 0.8 + 0.2) * a, (cGold[2] * 0.8 + 0.2) * a);
      }
  }

  // ---- the error trace, rows 64 to 127 ----
  const X = max(X0, 1.04 * r);
  const cw = X / 64; // radius to a column
  const ys = S.ys;
  const rowOf = (E) => ZERO - ys * E;
  const heat = S.heat;
  heat.fill(0);
  S.jc.fill(0);
  // jumps: count them per column first, so a dense column does not saturate
  for (let g = 0; g < S.ng && S.gr[g] <= r; g++) S.jc[min(63, floor(S.gr[g] / cw))]++;
  for (let g = 0; g < S.ng && S.gr[g] <= r; g++) {
    const nu = S.gr[g], x = min(63, floor(nu / cw)), rr = A * nu * nu;
    const Em = S.gn[g] - S.gc[g] - rr, Ep = S.gn[g] - rr;
    stroke(S, x, rowOf(Ep) - 64, rowOf(Em) - 64, 0.5 / (1 + 0.45 * (S.jc[x] - 1)));
    // the slope down to the next jump (or to the front), as the time the
    // trace spends in each row
    const nxt = g + 1 < S.ng ? min(S.gr[g + 1], r) : r;
    let a = nu;
    while (a < nxt - 1e-12) {
      let xc = floor(a / cw), b = min(nxt, (xc + 1) * cw);
      if (b <= a) {
        xc++;
        b = min(nxt, (xc + 1) * cw);
      }
      if (xc > 63) break;
      const ea = S.gn[g] - A * a * a, eb = S.gn[g] - A * b * b;
      const ya = rowOf(ea) - 64, yb = rowOf(eb) - 64, span = abs(yb - ya), f = (b - a) / cw;
      if (span < 1) stroke(S, xc, ya, ya, f * RAMP);
      else {
        const lo = floor(min(ya, yb)), hi = floor(max(ya, yb));
        for (let y = max(lo, 1); y <= min(hi, 63); y++) heat[y * 64 + xc] += (f * RAMP) / span;
      }
      a = b;
    }
  }
  const Ehead = countAt(S, r) - A * r * r;
  // the band: +-3 sqrt(r), faint, as a curve over the whole width
  const bandRow = (x) => 3 * sqrt(max(0, (x + 0.5) * cw)) * ys;
  for (let x = 0; x < 64; x++) {
    const b0 = bandRow(x - 0.5), b1 = bandRow(x + 0.5);
    for (const sg of [-1, 1]) {
      const ya = ZERO + sg * b0, yb = ZERO + sg * b1;
      const lo = floor(min(ya, yb)), hi = floor(max(ya, yb));
      for (let y = max(lo, 65); y <= min(hi, 127); y++) {
        const o = (y * W + x) * 3;
        buf[o] = max(buf[o], cTeal[0] * 0.8);
        buf[o + 1] = max(buf[o + 1], cTeal[1] * 0.8);
        buf[o + 2] = max(buf[o + 2], cTeal[2] * 0.8);
      }
    }
  }
  // the axis E = 0, dotted
  for (let x = 0; x < 64; x += 2) {
    const o = (ZERO * W + x) * 3;
    buf[o] = max(buf[o], 0.3 * cTeal[0]);
    buf[o + 1] = max(buf[o + 1], 0.3 * cTeal[1]);
    buf[o + 2] = max(buf[o + 2], 0.3 * cTeal[2]);
  }
  for (let y = 1; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const hv = heat[y * 64 + x];
      if (hv <= 0) continue;
      // every inked LED is bright; more ink goes paler, not darker
      const v = 1 - exp(-3 * hv);
      hsv(h0 - 0.37, 0.95 - 0.55 * v, 0.8 + 0.2 * v, tmp);
      const o = ((y + 64) * W + x) * 3;
      buf[o] = max(buf[o], tmp[0]);
      buf[o + 1] = max(buf[o + 1], tmp[1]);
      buf[o + 2] = max(buf[o + 2], tmp[2]);
    }
  // the head of the trace
  if (r > 0) {
    const xf = floor(min(63, r / cw)), yf = floor(rowOf(Ehead));
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 0; dx++) {
        const x = xf + dx, y = yf + dy;
        if (x < 0 || x > 63 || y < 65 || y > 127) continue;
        const o = (y * W + x) * 3;
        buf[o] = 1;
        buf[o + 1] = 1;
        buf[o + 2] = 0.9;
      }
  }
  for (let p2 = 0; p2 < W * H; p2++) {
    const o = p2 * 3;
    display.setPixel(p2 & 63, p2 >> 6, min(255, buf[o] * gm * 255), min(255, buf[o + 1] * gm * 255), min(255, buf[o + 2] * gm * 255));
  }
}
