// ===== Patternflow pattern =====
// Title:   Mamikon's Theorem
// Family:  line
// Idea:    In the top square a segment of fixed length runs round an oval, always tangent to it at one end, and the ring it sweeps fills in twelve colours by the segment's angle, while in the bottom square the same segment, carried to one fixed point, sweeps a disk in the same colours at the same moments, so that every wedge of the ring, fan-shaped where the oval turns sharply and a long thin sliver where it is flat, has the area of its slice of the disk, and the whole ring has the disk's area whatever the oval.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Mamikon's theorem on tangent sweeps and tangent clusters (Mamikon Mnatsakanian, 1959), pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Oval=0..3, Length=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. At 0 the twelve wedges run from teal, where the segment starts at the top of the oval, through azure and violet to pink; at 0.5 from red through gold to green. The oval's outline and the segment stay near white.
// Knob 2: Speed. One turn of the segment takes 9 / Speed seconds: 4.5 s at the opening 2, 45 s at 0.2 and 3 s at 3. The ring fills in one turn, holds full for a fifth of a turn, drains in the next turn and stays empty for an eighth of one.
// Knob 3: Oval. The curve, with the disk below left as it is: 0 an ellipse twice as wide as it is tall, 1 a triangle with rounded corners, 2 a square with rounded corners, 3 a thin stadium, and the shapes between are their Minkowski blends, so every setting is a convex oval. Round the triangle the ring is three fans, round the square a pinwheel of four quarter disks, round the stadium two half disks, and each has the area of the disk.
// Knob 4: Length. The segment, 20 LEDs long at 0 and 16 to 25 across the range (20.3 at the opening 0.06); the disk's radius is the same length. The oval is scaled so that it and its ring fill the top square, so a longer segment means a smaller oval in a wider ring.

// Let a segment of length L touch a curve at one end and point along the
// curve's tangent. Run that end round a closed convex curve once: the
// segment sweeps the ring between the curve and the path of its far end,
// the tangent sweep. Now carry every one of those segments, unturned, so
// that its touching end sits at one point: they fill a disk of radius L,
// the tangent cluster. Mamikon's theorem says the two have the same area,
// so the ring has area pi L^2 whatever the curve. A wedge of the ring made
// while the tangent turns through d theta has area L^2 d theta / 2, the
// same as the slice of the disk for that d theta: a point at distance t
// along the tangent at angle theta covers t dt d theta in both. That is
// why the colours here go by the tangent's angle, twelve wedges of 30
// degrees, and the brightness by t / L. Where the curve is flat the
// segment slides along itself and sweeps nothing, and the disk below
// waits.
//
// The ovals are kept as support functions: h(theta) is how far the
// tangent line with outward normal (cos theta, sin theta) is from the
// centre, the touching point is h n + h' n', and the tangent direction is
// n' = (-sin theta, cos theta). A point Q lies on that tangent line when
// g(theta) = Q . n - h(theta) is 0, and g' = Q . n' - h' is exactly how far
// Q is along the tangent from the touching point. So for each LED outside
// the oval the forward tangent is the root where g goes from negative to
// positive, found on 128 angles and polished by Newton's method, and g' at
// that root is t. Blending two support functions linearly is a Minkowski
// blend of the two shapes, and stays convex.
//
// The segment's clock runs partly by the tangent's angle and partly by arc
// length, so it turns at the corners and slides along the sides instead
// of jumping across them; the fill below keeps step because both halves
// fill by the same angle.

const W = 64, H = 128, TOP = 64;
const { floor, min, max, round, sqrt, sin, cos, atan2, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

const F = 256; // angles in the fine tables: the segment's run and the outline
const C = 2; // every C-th of them is searched for an LED's tangent
const M = F / C;
const TH0 = -PI / 2; // the run starts at the top, the segment pointing right
const WEDGES = 12;
const GHOST = 0.26;
const SLIDE = 0.45; // share of the segment's clock that goes by arc length
const BOX = 60;
const DX = 32, DY = 96; // the disk's centre
// One cycle, in turns: fill, hold full, drain, hold empty.
const FILL = 1, FULL = 0.2, DRAIN = 1, EMPTY = 0.125, CYCLE = FILL + FULL + DRAIN + EMPTY;

const TRI = [[0, -1], [0.866, 0.5], [-0.866, 0.5]];
const SQR = [[-0.72, -0.72], [0.72, -0.72], [0.72, 0.72], [-0.72, 0.72]];
const SHAPES = [{ a: 1, b: 0.5 }, { v: TRI, r: 0.16 }, { v: SQR, r: 0.12 }, { v: [[-1, 0], [1, 0]], r: 0.14 }];

// h and h' of one shape at the normal (c, s).
function sup1(sh, c, s, o) {
  if (sh.v) {
    let best = -1e9, bi = 0;
    for (let i = 0; i < sh.v.length; i++) {
      const d = sh.v[i][0] * c + sh.v[i][1] * s;
      if (d > best) {
        best = d;
        bi = i;
      }
    }
    o[0] = best + sh.r;
    o[1] = sh.v[bi][1] * c - sh.v[bi][0] * s;
  } else {
    const h = sqrt(sh.a * sh.a * c * c + sh.b * sh.b * s * s);
    o[0] = h;
    o[1] = ((sh.b * sh.b - sh.a * sh.a) * s * c) / h;
  }
}

const ta = [0, 0], tb = [0, 0];
function sup(S, c, s, o) {
  sup1(SHAPES[S.si], c, s, ta);
  sup1(SHAPES[S.si + 1], c, s, tb);
  o[0] = (1 - S.sw) * ta[0] + S.sw * tb[0];
  o[1] = (1 - S.sw) * ta[1] + S.sw * tb[1];
}

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// An antialiased line of width w into a coverage buffer of the given width, max-blended.
function line(buf, bw, bh, x0, y0, x1, y1, w, a) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9, e = w / 2 + 0.5;
  const ya = max(0, floor(min(y0, y1) - e)), yb = min(bh - 1, floor(max(y0, y1) + e));
  const xa = max(0, floor(min(x0, x1) - e)), xb = min(bw - 1, floor(max(x0, x1) + e));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0, t = cl((px * dx + py * dy) / L2, 0, 1);
      const ex = px - t * dx, ey = py - t * dy, c = a * cl(e - sqrt(ex * ex + ey * ey), 0, 1);
      const i = y * bw + x;
      if (c > buf[i]) buf[i] = c;
    }
}

function dot(buf, bw, bh, x0, y0, r, a) {
  for (let y = max(0, floor(y0 - r - 1)); y <= min(bh - 1, floor(y0 + r + 1)); y++)
    for (let x = max(0, floor(x0 - r - 1)); x <= min(bw - 1, floor(x0 + r + 1)); x++) {
      const ex = x + 0.5 - x0, ey = y + 0.5 - y0, c = a * cl(r + 0.5 - sqrt(ex * ex + ey * ey), 0, 1), i = y * bw + x;
      if (c > buf[i]) buf[i] = c;
    }
}

export function setup(params) {
  const S = {
    ph: 0, hue: 0, L: 20, oval: 0, key: "", hkey: "", si: 0, sw: 0, sig: 1, ox: 32, oy: 32,
    cs: new Float32Array(F + 1), sn: new Float32Array(F + 1), hh: new Float32Array(F + 1),
    px: new Float32Array(F + 1), py: new Float32Array(F + 1), m: new Float32Array(F + 1),
    u: new Float32Array(W * H), t: new Float32Array(W * H), rim: new Float32Array(W * TOP),
    col: new Float32Array(W * H * 3), out: new Float32Array(W * H * 3), seg: new Float32Array(W * H),
    o: [0, 0],
  };
  for (let j = 0; j <= F; j++) {
    const th = TH0 + (TAU * j) / F;
    S.cs[j] = cos(th);
    S.sn[j] = sin(th);
  }
  params.s = S;
}

function extent(S, sig, L) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let j = 0; j < F; j++) {
    const ax = sig * S.px[j], ay = sig * S.py[j], bx = ax - L * S.sn[j], by = ay + L * S.cs[j];
    x0 = min(x0, ax, bx);
    x1 = max(x1, ax, bx);
    y0 = min(y0, ay, by);
    y1 = max(y1, ay, by);
  }
  S.bx = (x0 + x1) / 2;
  S.by = (y0 + y1) / 2;
  return max(x1 - x0, y1 - y0);
}

// Everything that depends on the oval and the length: the scale, the
// segment's run, and for every LED its tangent angle and distance.
function build(S) {
  const L = S.L, o = S.o;
  const v = cl(S.oval, 0, 3);
  S.si = min(2, floor(v));
  S.sw = v - S.si;
  for (let j = 0; j <= F; j++) {
    const c = S.cs[j], s = S.sn[j];
    sup(S, c, s, o);
    S.hh[j] = o[0];
    S.px[j] = o[0] * c - o[1] * s;
    S.py[j] = o[0] * s + o[1] * c;
  }
  let lo = 0, hi = BOX;
  for (let it = 0; it < 24; it++) {
    const mid = (lo + hi) / 2;
    if (extent(S, mid, L) <= BOX) lo = mid;
    else hi = mid;
  }
  const sig = (S.sig = lo);
  extent(S, sig, L);
  S.ox = 32 - S.bx;
  S.oy = 32 - S.by;
  // The touching points in LEDs, and the segment's clock along them.
  let per = 0;
  for (let j = 0; j <= F; j++) {
    S.px[j] = sig * S.px[j] + S.ox;
    S.py[j] = sig * S.py[j] + S.oy;
    if (j) per += sqrt((S.px[j] - S.px[j - 1]) ** 2 + (S.py[j] - S.py[j - 1]) ** 2);
  }
  S.m[0] = 0;
  for (let j = 1; j <= F; j++) {
    const ds = sqrt((S.px[j] - S.px[j - 1]) ** 2 + (S.py[j] - S.py[j - 1]) ** 2);
    S.m[j] = S.m[j - 1] + (1 - SLIDE) / F + (SLIDE * ds) / (per || 1);
  }
  for (let j = 0; j <= F; j++) S.m[j] /= S.m[F];

  // The top square: each LED outside the oval, its forward tangent.
  S.rim.fill(0);
  for (let j = 0; j < F; j++) line(S.rim, W, TOP, S.px[j], S.py[j], S.px[j + 1], S.py[j + 1], 1.1, 1);
  for (let y = 0; y < TOP; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, qx = x + 0.5 - S.ox, qy = y + 0.5 - S.oy;
      S.u[p] = -1;
      let jp = F - C, gp = qx * S.cs[jp] + qy * S.sn[jp] - sig * S.hh[jp], k = -1, g = 0;
      for (let i = 0; i < M; i++) {
        const j = i * C;
        g = qx * S.cs[j] + qy * S.sn[j] - sig * S.hh[j];
        if (gp < 0 && g >= 0) {
          k = i;
          break;
        }
        gp = g;
      }
      if (k < 0) continue;
      const a0 = TH0 + (TAU * (k - 1)) / M, a1 = a0 + TAU / M;
      let th = a0 + ((TAU / M) * -gp) / (g - gp), t = 0;
      for (let it = 0; it < 3; it++) {
        const c = cos(th), s = sin(th);
        sup(S, c, s, o);
        const gg = qx * c + qy * s - sig * o[0];
        t = qy * c - qx * s - sig * o[1];
        if (it === 2 || t < 1e-4) break;
        const tn = th - gg / t;
        if (tn < a0 || tn > a1) break;
        th = tn;
      }
      if (t < 0 || t > L + 1) continue;
      let u = (th - TH0) / TAU;
      u -= floor(u);
      S.u[p] = u;
      S.t[p] = t;
    }
  // The bottom square: the tangent cluster, a disk of radius L.
  for (let y = TOP; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, dx = x + 0.5 - DX, dy = y + 0.5 - DY, d = sqrt(dx * dx + dy * dy);
      S.u[p] = -1;
      if (d > L + 1) continue;
      let u = atan2(dy, dx) / TAU;
      u -= floor(u);
      S.u[p] = u;
      S.t[p] = d;
    }
}

function paint(S) {
  const L = S.L;
  for (let p = 0; p < W * H; p++) {
    const u = S.u[p];
    if (u < 0) {
      S.col[p * 3] = S.col[p * 3 + 1] = S.col[p * 3 + 2] = 0;
      continue;
    }
    const t = S.t[p], aa = cl(L - t + 0.5, 0, 1), tau = cl(t / L, 0, 1), wedge = floor(u * WEDGES);
    hsv(S.hue + 0.48 + 0.42 * u, 0.8, (wedge & 1 ? 0.68 : 1) * (0.42 + 0.58 * tau) * aa, S.col, p * 3);
  }
}

// Where the segment is at a fraction q of its clock: its angle as a
// fraction of the turn, and its touching point.
function at(S, q) {
  let a = 0, b = F;
  while (b - a > 1) {
    const c = (a + b) >> 1;
    if (S.m[c] <= q) a = c;
    else b = c;
  }
  const f = cl((q - S.m[a]) / (S.m[a + 1] - S.m[a] || 1), 0, 1);
  S.phi = (a + f) / F;
  S.qx = S.px[a] + (S.px[a + 1] - S.px[a]) * f;
  S.qy = S.py[a] + (S.py[a + 1] - S.py[a]) * f;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.oval = cl(k[2] || 0, 0, 3);
  S.L = 20 * pow(1.25, cl(k[3] == null ? 0.06 : k[3], -1, 1));
  S.ph = (S.ph + (d * speed) / 9) % CYCLE;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const key = S.oval + "|" + S.L;
  if (key !== S.key) {
    S.key = key;
    build(S);
    S.hkey = "";
  }
  if (S.hkey !== key + "|" + S.hue) {
    S.hkey = key + "|" + S.hue;
    paint(S);
  }
  const ph = S.ph, L = S.L;
  let mode;
  if (ph < FILL) {
    mode = 0;
    at(S, ph);
  } else if (ph < FILL + FULL) {
    mode = 1;
    at(S, 0);
  } else if (ph < FILL + FULL + DRAIN) {
    mode = 2;
    at(S, ph - FILL - FULL);
  } else {
    mode = 3;
    at(S, 0);
  }
  const phi = S.phi, out = S.out, col = S.col;
  for (let p = 0; p < W * H; p++) {
    const u = S.u[p];
    let f = 0;
    if (u >= 0) {
      if (mode === 1) f = 1;
      else if (mode === 3) f = GHOST;
      else if (mode === 0) {
        const lag = phi - u;
        f = lag >= 0 ? 1 + (lag < 0.04 ? 0.6 * (1 - lag / 0.04) : 0) : GHOST;
      } else f = u < phi ? GHOST : 1;
    }
    out[p * 3] = col[p * 3] * f;
    out[p * 3 + 1] = col[p * 3 + 1] * f;
    out[p * 3 + 2] = col[p * 3 + 2] * f;
  }
  // The oval's outline, pale over the ring.
  for (let p = 0; p < W * TOP; p++) {
    const r = S.rim[p] * 0.9;
    if (r <= 0) continue;
    out[p * 3] = max(out[p * 3], r * 0.86);
    out[p * 3 + 1] = max(out[p * 3 + 1], r * 0.92);
    out[p * 3 + 2] = max(out[p * 3 + 2], r);
  }
  // The segment, above at the oval and below at the disk's centre.
  const th = TH0 + TAU * phi, tx = -sin(th), ty = cos(th), seg = S.seg;
  seg.fill(0);
  line(seg, W, H, S.qx, S.qy, S.qx + L * tx, S.qy + L * ty, 1.3, 1);
  dot(seg, W, H, S.qx, S.qy, 1.4, 1);
  line(seg, W, H, DX, DY, DX + L * tx, DY + L * ty, 1.3, 1);
  dot(seg, W, H, DX, DY, 1.4, 1);
  for (let p = 0; p < W * H; p++) {
    const a = seg[p];
    if (a > 0) {
      out[p * 3] += (1 - out[p * 3]) * a;
      out[p * 3 + 1] += (1 - out[p * 3 + 1]) * a;
      out[p * 3 + 2] += (1 - out[p * 3 + 2]) * a;
    }
  }
  for (let p = 0; p < W * H; p++)
    display.setPixel(p % W, floor(p / W), round(cl(out[p * 3], 0, 1) * 255), round(cl(out[p * 3 + 1], 0, 1) * 255), round(cl(out[p * 3 + 2], 0, 1) * 255));
}
