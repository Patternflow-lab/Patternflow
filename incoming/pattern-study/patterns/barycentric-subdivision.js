// ===== Patternflow pattern =====
// Title:   Barycentric Subdivision
// Family:  fractal
// Idea:    A triangle cut along its medians into six, and each of those again, fills the panel as a mosaic coloured by each piece's largest angle, and the camera dives child after child down one random line of descent, outlined in white three steps ahead and turning and scaling but never stretching, until the pieces are hot slivers and the walk starts again.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: iterated barycentric subdivision, whose triangles flatten (Imre Bárány, Alan F. Beardon and T. Keith Carne, 1996; Persi Diaconis and Laurent Miclo, 2011), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=2..3, Steer=0..1
//
// Knob 1: Hue. Turns the whole angle scale round the wheel. At 0 a piece whose largest angle is 60 degrees is cyan, 90 azure, 120 blue, 150 violet, 170 magenta, 177 rose and 179 red-orange, and one within a third of a degree of flat is a pale amber.
// Knob 2: Speed. At 2 the camera takes 2.2 seconds to dive from one triangle into the next, slowing as it arrives; at 0.2 ten times slower, at 3 half as fast again. When the current triangle's largest angle passes 179 degrees the picture fades and starts again from an equilateral triangle; with random steps that happens after 25 dives in the median, under a minute at 2.
// Knob 3: Depth. How many levels below the current triangle the mosaic is cut. At 2 the current triangle shows as 36 pieces and the third level, 216, fades in as the camera closes on the next triangle, which then shows 36 of its own; at 3 it is 216 going to 1,296. A piece whose smallest height on the panel is under 3 LEDs is never cut, so the slivers stay whole and the finest level shows only inside the rounder pieces.
// Knob 4: Steer. The chance at each step that the camera takes the roundest of the six children instead of a random one, from 0 at 0.1 to 1 at the top. Up to 0.1 every step is random as in the theorem, and after 40 steps two descents in three have a largest angle over 179 degrees. At 0.3, two steps in nine steered, it is one in twelve. From 0.4, one step in three, the shapes hold: the median largest angle stays near 115 degrees and the colours stay cool. At 1 every step takes the roundest child and the largest angle stays between 68 and 90 degrees.
// Buttons: K1 tap starts again from an equilateral triangle.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, atan2, acos, abs, exp, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// A child is named by the order of the barycentric coordinates inside it:
// child c holds the points whose largest coordinate is CI[c] and second CJ[c].
// Its corners are the vertex CI, the midpoint of the side CI-CJ and the
// centroid, in that order. With corners 0, 1 and z, child c has the shape
// 2(1+z)/3, 2(1+z)/3z, (4-2z)/3, 2(z-2)/3(z-1), 2(2z-1)/3z, 2(1-2z)/3(1-z):
// a fixed Moebius map of z, or of its mirror image for c = 1, 2 and 5.
const CI = [0, 0, 1, 1, 2, 2], CJ = [1, 2, 0, 2, 0, 1];
// Triangles kept above the current one, for the mosaic round it.
const KEEP = 12;
// Seconds per level at Speed 1.
const LEVEL = 4.4;
// A line of descent ends when the current triangle's largest angle passes this.
const FLAT = 179;
// A triangle whose smallest height on the panel is under LOD LEDs is not cut
// further; up to twice that its children fade in.
const LOD = 3;
// Margin in LEDs when a triangle is framed.
const MG = 1;
// Angle scale: LUT entries from 60 to 180 degrees.
const NL = 512;

function child(src, so, c, dst, d) {
  const i = 2 * CI[c], j = 2 * CJ[c];
  const xi = src[so + i], yi = src[so + i + 1];
  const gx = (src[so] + src[so + 2] + src[so + 4]) / 3, gy = (src[so + 1] + src[so + 3] + src[so + 5]) / 3;
  dst[d] = xi;
  dst[d + 1] = yi;
  dst[d + 2] = 0.5 * (xi + src[so + j]);
  dst[d + 3] = 0.5 * (yi + src[so + j + 1]);
  dst[d + 4] = gx;
  dst[d + 5] = gy;
}

// Where a triangle sits on the colour scale, 0 to 1: half is its largest
// angle from 60 to 180 degrees, half how far it is short of flat on a log
// scale from 30 degrees down to 0.3, so 170, 177 and 179.5 look different.
function heat(t, o) {
  const a = bigAngle(t, o), d = 180 - a;
  return cl(0.5 * ((a - 60) / 120) + 0.5 * cl((Math.log10(30) - Math.log10(d > 1e-9 ? d : 1e-9)) / 2, 0, 1), 0, 1);
}

// Largest angle of a triangle, in degrees.
function bigAngle(t, o) {
  const ax = t[o + 2] - t[o + 4], ay = t[o + 3] - t[o + 5];
  const bx = t[o + 4] - t[o], by = t[o + 5] - t[o + 1];
  const cx = t[o] - t[o + 2], cy = t[o + 1] - t[o + 3];
  let m = ax * ax + ay * ay, p = bx * bx + by * by, q = cx * cx + cy * cy, w;
  if (p > m) (w = m), (m = p), (p = w);
  if (q > m) (w = m), (m = q), (q = w);
  return (acos(cl((p + q - m) / (2 * sqrt(p * q) + 1e-300), -1, 1)) * 180) / PI;
}

// The similarity z -> a z + b that sets triangle t as large as it fits in the
// panel, preferring small turns from the present view. Writes [ar, ai, br, bi].
function frame(t, o, out) {
  let best = -1, bs = 1, bt = 0, lx = 0, ly0 = 0, ll = 0;
  for (let v = 0; v < 6; v += 2) {
    const w = (v + 2) % 6, dx = t[o + w] - t[o + v], dy = t[o + w + 1] - t[o + v + 1];
    if (dx * dx + dy * dy > ll) (ll = dx * dx + dy * dy), (lx = dx), (ly0 = dy);
  }
  const tryAt = (th) => {
    if (th > PI) th -= 2 * PI;
    if (th <= -PI) th += 2 * PI;
    const c = cos(th), sn = sin(th);
    let x0 = 1e300, x1 = -1e300, y0 = 1e300, y1 = -1e300;
    for (let v = 0; v < 6; v += 2) {
      const x = t[o + v], y = t[o + v + 1], rx = c * x - sn * y, ry = sn * x + c * y;
      if (rx < x0) x0 = rx;
      if (rx > x1) x1 = rx;
      if (ry < y0) y0 = ry;
      if (ry > y1) y1 = ry;
    }
    const sc = min((W - 2 * MG) / (x1 - x0 + 1e-300), (H - 2 * MG) / (y1 - y0 + 1e-300));
    // A long side stood upright scores a quarter more, so a sliver stands
    // along the columns instead of the panel's diagonal.
    const ly = sn * lx + c * ly0;
    const score = sc * (1 - (0.3 * abs(th)) / PI) * (1 + 0.25 * (ly * ly / ll) ** 8);
    if (score > best) (best = score), (bs = sc), (bt = th);
  };
  for (let n = -48; n < 48; n++) tryAt((n * PI) / 48);
  const t0 = bt;
  for (let n = -16; n <= 16; n++) tryAt(t0 + (n * PI) / 768);
  const ar = bs * cos(bt), ai = bs * sin(bt);
  let x0 = 1e300, x1 = -1e300, y0 = 1e300, y1 = -1e300;
  for (let v = 0; v < 6; v += 2) {
    const x = t[o + v], y = t[o + v + 1], rx = ar * x - ai * y, ry = ai * x + ar * y;
    if (rx < x0) x0 = rx;
    if (rx > x1) x1 = rx;
    if (ry < y0) y0 = ry;
    if (ry > y1) y1 = ry;
  }
  out[0] = ar;
  out[1] = ai;
  out[2] = W / 2 - 0.5 * (x0 + x1);
  out[3] = H / 2 - 0.5 * (y0 + y1);
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The colour scale: cyan for round pieces through blue, violet, magenta and
// rose to a pale amber for flat ones.
function palette(s) {
  for (let n = 0; n < NL; n++) {
    const t = n / (NL - 1);
    hsv(s.hue + 0.48 + 0.64 * t, 0.9 - 0.35 * t ** 6, 0.62 + 0.38 * t, s.lut, n * 3);
  }
  s.lutHue = s.hue;
}

export function setup(params) {
  const s = {
    hue: 0, depth: 2, steer: 0,
    // Stored triangles in world coordinates: 0 is the current one, j its j-th
    // ancestor; path[j] is the child taken from j + 1 to j.
    tri: new Float64Array((KEEP + 1) * 6), path: new Int8Array(KEEP + 1), nA: 1,
    // The planned line of descent: plan[0] leads from the current triangle to
    // the next, plan[1] and plan[2] on from there.
    next: 0, plan: new Int8Array(3), dz: new Float64Array(4), u: 0, level: 0, ang: 60,
    ow: new Float32Array(W * H), ot: new Float64Array(24),
    gain: 1, fading: 0, lut: new Float64Array(NL * 3), lutHue: -1, tmp: new Float64Array(36),
    // Drawing: one triangle per depth of the walk, the path as seen from the
    // oldest kept triangle, and the frame.
    P: new Float64Array(40 * 6), pc: new Int8Array(KEEP + 2), A: 0, tgt: 0, w: 0, spIn: 1, spOut: 1,
    fb: new Float32Array(W * H * 3), mark: new Uint8Array(W * H),
  };
  params.s = s;
  // The first update reads the knobs and then plans the first steps.
  s.fresh = true;
}

function restart(s) {
  // An equilateral triangle, turned at random, then framed.
  const th = Math.random() * 2 * PI, t = s.tri;
  for (let v = 0; v < 3; v++) {
    t[2 * v] = cos(th + (v * 2 * PI) / 3);
    t[2 * v + 1] = sin(th + (v * 2 * PI) / 3);
  }
  frame(t, 0, s.dz);
  apply(t, 0, s.dz);
  s.nA = 1;
  s.u = 0;
  s.level = 0;
  s.ang = 60;
  const k = s.tmp;
  for (let v = 0; v < 6; v++) k[v] = t[v];
  for (let m = 0; m < 3; m++) {
    s.plan[m] = pick(s, k, m * 6);
    child(k, m * 6, s.plan[m], k, m * 6 + 6);
  }
  aim(s);
}

function apply(t, o, z) {
  for (let v = o; v < o + 6; v += 2) {
    const x = t[v], y = t[v + 1];
    t[v] = z[0] * x - z[1] * y + z[2];
    t[v + 1] = z[1] * x + z[0] * y + z[3];
  }
}

// Picks a child of triangle t: at random, or with chance Steer the roundest
// one; between children of the same shape, the one the camera reaches with
// the smallest turn.
function pick(s, t, o) {
  let c = floor(Math.random() * 6) % 6;
  if (Math.random() < s.steer) {
    const k = s.ot, z = [0, 0, 0, 0];
    let bv = 1e9, bt = 1e9;
    for (let n = 0; n < 6; n++) {
      child(t, o, n, k, 0);
      const a = bigAngle(k, 0);
      frame(k, 0, z);
      const turn = abs(atan2(z[1], z[0]));
      if (a < bv - 1e-6 || (a < bv + 1e-6 && turn < bt)) (bv = min(bv, a)), (bt = turn), (c = n);
    }
  }
  return c;
}

// The similarity that frames the next triangle.
function aim(s) {
  s.next = s.plan[0];
  child(s.tri, 0, s.next, s.tmp, 0);
  frame(s.tmp, 0, s.dz);
}

function advance(s) {
  const t = s.tri, z = s.dz;
  for (let j = 0; j < s.nA; j++) apply(t, j * 6, z);
  const keep = min(s.nA, KEEP);
  for (let j = keep; j > 0; j--) {
    for (let v = 0; v < 6; v++) t[j * 6 + v] = t[(j - 1) * 6 + v];
    s.path[j] = s.path[j - 1];
  }
  child(t, 6, s.next, t, 0);
  s.path[0] = s.next;
  s.nA = keep + 1;
  s.level++;
  s.ang = bigAngle(t, 0);
  if (s.ang > FLAT && !s.fading) s.fading = 1;
  const k = s.tmp, pl = s.plan;
  pl[0] = pl[1];
  pl[1] = pl[2];
  child(t, 0, pl[0], k, 0);
  child(k, 0, pl[1], k, 6);
  pl[2] = pick(s, k, 6);
  aim(s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3);
  s.depth = cl(k[2], 2, 3);
  s.steer = cl((k[3] - 0.1) / 0.9, 0, 1);
  if (s.fresh) {
    s.fresh = false;
    restart(s);
  }
  if (input.btnPressed && input.btnPressed[0] && !s.fading) s.fading = 2;
  if (s.fading) {
    // Fade out, start again, fade in.
    s.gain -= d * (s.fading === 2 ? 4 : 1.5);
    if (s.gain <= 0) {
      s.gain = 0;
      s.fading = 0;
      restart(s);
    }
  } else s.gain = min(1, s.gain + d * 1.5);
  s.u += (d * sp) / LEVEL;
  while (s.u >= 1) {
    s.u -= 1;
    advance(s);
  }
}

// Fills one triangle's LEDs: the colour, darkened near the parent's sides
// (heights hc2 and hj) at weight wl and near the child's own inner sides
// (heights hc0, hc1) at weight wk.
function raster(s, X0, Y0, X1, Y1, X2, Y2, r, g, b, hc0, hc1, hc2, hj, wl, wk) {
  const ex = X1 - X0, ey = Y1 - Y0, fx = X2 - X0, fy = Y2 - Y0, dd = ex * fy - fx * ey;
  if (!(abs(dd) > 1e-12)) return;
  const a1 = fy / dd, b1 = -fx / dd, c1 = (fx * Y0 - fy * X0) / dd;
  const a2 = -ey / dd, b2 = ex / dd, c2 = (ey * X0 - ex * Y0) / dd;
  const a0 = -a1 - a2, b0 = -b1 - b2, c0 = 1 - c1 - c2;
  const ya = max(0, Math.ceil(min(Y0, Y1, Y2) - 0.5)), yb = min(H - 1, floor(max(Y0, Y1, Y2) - 0.5));
  const xa = max(0, Math.ceil(min(X0, X1, X2) - 0.5)), xb = min(W - 1, floor(max(X0, X1, X2) - 0.5));
  const { fb, mark } = s;
  for (let y = ya; y <= yb; y++) {
    const py = y + 0.5;
    let lo = xa, hi = xb;
    for (let e = 0; e < 3; e++) {
      const a = e === 0 ? a0 : e === 1 ? a1 : a2, bt = e === 0 ? b0 * py + c0 : e === 1 ? b1 * py + c1 : b2 * py + c2;
      if (a > 1e-12) {
        const x = Math.ceil(-bt / a - 0.5);
        if (x > lo) lo = x;
      } else if (a < -1e-12) {
        const x = floor(-bt / a - 0.5);
        if (x < hi) hi = x;
      } else if (bt < 0) hi = -1;
    }
    for (let x = lo; x <= hi; x++) {
      const px = x + 0.5, q1 = a1 * px + b1 * py + c1, q2 = a2 * px + b2 * py + c2, q0 = 1 - q1 - q2;
      let dl = q2 * hc2, dk = q0 * hc0;
      const dj = (0.5 * q1 + q2 / 3) * hj, d1 = q1 * hc1;
      if (dj < dl) dl = dj;
      if (d1 < dk) dk = d1;
      const el = wl * (1 - cl((dl - 0.15) / 0.6, 0, 1)), ek = wk * (1 - cl((dk - 0.15) / 0.6, 0, 1));
      const f = 1 - 0.8 * (el > ek ? el : ek), i = y * W + x;
      fb[i * 3] = r * f;
      fb[i * 3 + 1] = g * f;
      fb[i * 3 + 2] = b * f;
      mark[i] = 1;
    }
  }
}

// Draws the six children of the triangle at depth d, each in a mix of its
// parent's colour and its own at weight w, with its inner sides at weight w.
function emit(s, d, w, on, inT, A2, l0, l1, l2) {
  const P = s.P, o = d * 6, q = o + 6, lut = s.lut;
  let id = floor(heat(P, o) * (NL - 1)) * 3;
  const nr = lut[id], ng = lut[id + 1], nb = lut[id + 2];
  const s0 = sqrt(l0), s1 = sqrt(l1), s2 = sqrt(l2);
  const wl = cl((A2 / (s0 + s1 + s2) - 0.3) / 0.9, 0, 1), ca = A2 / 6;
  for (let c = 0; c < 6; c++) {
    child(P, o, c, P, q);
    let r = nr, g = ng, b = nb;
    if (w > 0) {
      id = floor(heat(P, q) * (NL - 1)) * 3;
      r += (lut[id] - nr) * w;
      g += (lut[id + 1] - ng) * w;
      b += (lut[id + 2] - nb) * w;
    }
    const X0 = P[q], Y0 = P[q + 1], X1 = P[q + 2], Y1 = P[q + 3], X2 = P[q + 4], Y2 = P[q + 5];
    const k0 = Math.hypot(X1 - X2, Y1 - Y2), k1 = Math.hypot(X2 - X0, Y2 - Y0), k2 = Math.hypot(X0 - X1, Y0 - Y1);
    const wk = w * cl((ca / (k0 + k1 + k2) - 0.3) / 0.9, 0, 1);
    const sp = inT || (on && d === s.A && c === s.next) ? s.spIn : s.spOut;
    const j = CJ[c], hj = A2 / (j === 0 ? s0 : j === 1 ? s1 : s2);
    raster(s, X0, Y0, X1, Y1, X2, Y2, r * sp, g * sp, b * sp, ca / k0, ca / k1, ca / k2, hj, wl, wk);
  }
}

// Walks the subdivision from the oldest kept triangle down to the mosaic's
// level, skipping triangles off the panel.
function walk(s, d, on, inT) {
  const P = s.P, o = d * 6;
  const x0 = P[o], y0 = P[o + 1], x1 = P[o + 2], y1 = P[o + 3], x2 = P[o + 4], y2 = P[o + 5];
  if (max(x0, x1, x2) < 0 || min(x0, x1, x2) > W || max(y0, y1, y2) < 0 || min(y0, y1, y2) > H) return;
  const A2 = abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0));
  const l0 = (x1 - x2) ** 2 + (y1 - y2) ** 2, l1 = (x2 - x0) ** 2 + (y2 - y0) ** 2, l2 = (x0 - x1) ** 2 + (y0 - y1) ** 2;
  const open = (d < s.tgt ? 1 : s.w) * cl((A2 / sqrt(max(l0, l1, l2)) - LOD) / LOD, 0, 1);
  if (open >= 1 && d < s.tgt) {
    for (let c = 0; c < 6; c++) {
      child(P, o, c, P, o + 6);
      const oc = on && d <= s.A && c === s.pc[d];
      walk(s, d + 1, oc, inT || (oc && d === s.A));
    }
  } else emit(s, d, open, on, inT, A2, l0, l1, l2);
}

function outline(ow, t, o, al) {
  for (let e = 0; e < 6; e += 2) {
    const ax = t[o + e], ay = t[o + e + 1], bx = t[o + ((e + 2) % 6)], by = t[o + ((e + 3) % 6)];
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 2.5) + 1;
    for (let i = 0; i <= n; i++) {
      const x = floor(ax + ((bx - ax) * i) / n), y = floor(ay + ((by - ay) * i) / n);
      if (x >= 0 && x < W && y >= 0 && y < H && ow[y * W + x] < al) ow[y * W + x] = al;
    }
  }
}

export function draw(display, params) {
  const s = params.s;
  if (!s || s.fresh) return;
  if (s.lutHue !== s.hue) palette(s);
  const { tri, dz, P, fb, mark } = s;
  // The camera: the spiral similarity from this triangle's frame to the next
  // one, raised to the eased progress v, about its fixed point.
  const u = s.u, v = u - (0.7 * sin(2 * PI * u)) / (2 * PI);
  const ar = dz[0], ai = dz[1], den = (1 - ar) * (1 - ar) + ai * ai;
  const qr = (dz[2] * (1 - ar) - dz[3] * ai) / den, qi = (dz[3] * (1 - ar) + dz[2] * ai) / den;
  const ls = log(Math.hypot(ar, ai)) * v, th = atan2(ai, ar) * v;
  const mr = exp(ls) * cos(th), mi = exp(ls) * sin(th);
  const A = s.nA - 1;
  for (let c = 0; c < 6; c += 2) {
    const x = tri[A * 6 + c] - qr, y = tri[A * 6 + c + 1] - qi;
    P[c] = qr + mr * x - mi * y;
    P[c + 1] = qi + mi * x + mr * y;
  }
  for (let d = 0; d < A; d++) s.pc[d] = s.path[A - 1 - d];
  s.pc[A] = s.next;
  s.A = A;
  // The mosaic's depth below the current triangle runs on with the dive, so
  // the next level fades in as the camera closes in.
  const e = s.depth + v, L = floor(e);
  s.tgt = A + L;
  s.w = e - L;
  const { ow, ot, plan } = s;
  for (let c = 0; c < 6; c += 2) {
    const x = tri[c] - qr, y = tri[c + 1] - qi;
    ot[c] = qr + mr * x - mi * y;
    ot[c + 1] = qi + mi * x + mr * y;
  }
  // Mid-dive the next triangle is lit and the rest dimmed, while the current
  // triangle is wide enough on the panel to be cut.
  const l0 = (ot[2] - ot[4]) ** 2 + (ot[3] - ot[5]) ** 2, l1 = (ot[4] - ot[0]) ** 2 + (ot[5] - ot[1]) ** 2, l2 = (ot[0] - ot[2]) ** 2 + (ot[1] - ot[3]) ** 2;
  const tall = abs((ot[2] - ot[0]) * (ot[5] - ot[1]) - (ot[4] - ot[0]) * (ot[3] - ot[1])) / sqrt(max(l0, l1, l2));
  const g = tall > 2 * LOD ? sin(PI * v) ** 2 : 0;
  s.spIn = 1 + 0.15 * g;
  s.spOut = 1 - 0.3 * g;
  fb.fill(0);
  mark.fill(0);
  walk(s, 0, true, false);
  // The planned line of descent in white: the next triangle and the two inside
  // it, each outline coming up as the one before it is reached.
  ow.fill(0);
  for (let m = 0; m < 3; m++) {
    child(ot, m * 6, plan[m], ot, m * 6 + 6);
    const x = m + 1 - v, al = x < 1 ? 0.5 * x : x < 2 ? 0.5 - 0.2 * (x - 1) : 0.3 * (3 - x);
    if (al > 0.01) outline(ow, ot, m * 6 + 6, al);
  }
  // An LED whose centre fell exactly on a shared side takes its neighbour's colour.
  const ex = P[2] - P[0], ey = P[3] - P[1], fx = P[4] - P[0], fy = P[5] - P[1], dd = ex * fy - fx * ey;
  const gain = s.gain * 255;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let i = y * W + x;
      if (!mark[i]) {
        const px = x + 0.5 - P[0], py = y + 0.5 - P[1];
        const b1 = (px * fy - py * fx) / dd, b2 = (ex * py - ey * px) / dd;
        if (b1 < 0 || b2 < 0 || b1 + b2 > 1) {
          display.setPixel(x, y, 0, 0, 0);
          continue;
        }
        if (x > 0 && mark[i - 1]) i--;
        else if (y > 0 && mark[i - W]) i -= W;
        else if (x < W - 1 && mark[i + 1]) i++;
      }
      const w = ow[y * W + x], f = 1 - w;
      display.setPixel(x, y, (fb[i * 3] * f + w) * gain, (fb[i * 3 + 1] * f + w) * gain, (fb[i * 3 + 2] * f + w) * gain);
    }
}
