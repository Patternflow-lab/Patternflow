// ===== Patternflow pattern =====
// Title:   Holditch Ring
// Family:  line
// Idea:    A chord of fixed length slides round a tall convex oval with both ends on it, the point that splits it into a and b leaves a gold trace, the ring between the oval and the trace fills behind the a-part, and an ellipse with semi-axes a and b in the middle fills with the same area of light as it goes, so both close together when the lap ends, and the next lap runs on a new oval with a different ring and the same ellipse.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Holditch's theorem (Hamnet Holditch, 1858), support functions and Minkowski sums of convex bodies (Hermann Minkowski, 1903), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Split=0.25..0.5, Chord=36..44
//
// Knob 1: Hue. Turns the colours round together. At 0 the oval is pale cyan, the trace gold and the ring and the ellipse violet; at 0.33 the oval is pink, the trace teal and the fills green; at 0.67 pale lime, violet and azure.
// Knob 2: Speed. At 2 a lap takes 6 seconds, then the full ring and ellipse pulse together for 1.2 s and the oval morphs into the next of six in 1.8 s, 9 seconds in all; at 0.2 the cycle takes 90 seconds, at 3 six.
// Knob 3: Split. a / (a + b), 0.25 to 0.5. With the opening 36 LED chord, at 0.25 a is 9 and b 27, the ring holds pi x 9 x 27 = 763 square LEDs and the ellipse is 18 wide and 54 tall; at 0.5 a and b are both 18, the ring holds 1018 and the ellipse is a circle 36 across.
// Knob 4: Chord. a + b, 36 to 44 LEDs. At a split of 0.25 the ring and the ellipse hold 763 square LEDs at 36 and 1140 at 44, and at 0.5 up to 1521. At 46 the first point ahead would jump 14 LEDs across the pointed end of the egg, and the chord would no longer slide.

const W = 64, H = 128, CX = 32, CY = 64;
const { floor, ceil, min, max, abs, sqrt, PI, cos, sin, atan2, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (a, b, x) => {
  const t = cl((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Points on the oval, taken at K even steps of the outward normal, and
// chord positions per lap.
const K = 240, N = 240;
// One cycle at Speed 2, in seconds.
const LAP = 6, HOLD = 1.2, MORPH = 1.8;

// The ovals, each a Minkowski sum: its support function is the sum of its
// parts', so a blend of two ovals taken normal by normal is convex all the
// way through. Parts: [0, A, B] an ellipse, [1, w, h] a rectangle,
// [2, r] a disc, [3, points] a polygon. In turn: an ellipse, a rounded
// rectangle, an egg, a stadium, a shield and a lozenge, each 58 x 122 LEDs,
// with ey where the ellipse sits best inside its trace. A tall rounded
// triangle was tried and left out: at its point a 40 LED chord already
// jumps 39 LEDs from one side to the other.
const OVALS = [
  { p: [[0, 29, 61]], ey: 64 },
  { p: [[1, 17, 49], [2, 12]], ey: 64 },
  { p: [[0, 25, 52], [3, [[0, -9], [4, 9], [-4, 9]]]], ey: 70 },
  { p: [[1, 0, 32], [2, 29]], ey: 64 },
  { p: [[3, [[-12, -44], [12, -44], [12, 28], [0, 44], [-12, 28]]], [2, 17]], ey: 60 },
  { p: [[3, [[0, -40], [9, -20], [9, 20], [0, 40], [-9, 20], [-9, -20]]], [0, 20, 21]], ey: 64 },
];

// The point of an oval whose outward normal is (c, s).
function support(oval, c, s, out) {
  let x = 0, y = 0;
  for (const q of oval.p) {
    if (q[0] === 0) {
      const h = hypot(q[1] * c, q[2] * s);
      (x += (q[1] * q[1] * c) / h), (y += (q[2] * q[2] * s) / h);
    } else if (q[0] === 1) (x += c < 0 ? -q[1] : q[1]), (y += s < 0 ? -q[2] : q[2]);
    else if (q[0] === 2) (x += q[1] * c), (y += q[1] * s);
    else {
      let best = -1e9, bx = 0, by = 0;
      for (const v of q[1]) {
        const d = v[0] * c + v[1] * s;
        if (d > best) (best = d), (bx = v[0]), (by = v[1]);
      }
      (x += bx), (y += by);
    }
  }
  out[0] = x;
  out[1] = y;
}

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}
// Soft fills take hues from a wheel that skips orange through yellow,
// which read brown and olive when dim.
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

export function setup(params) {
  params.s = {
    f: 0, t: 0, ox: new Float32Array(K), oy: new Float32Array(K), arc: new Float64Array(K + 1),
    sx: new Float32Array((N + 1) * 4), ang: new Float64Array(N + 1), area: new Float64Array(N + 1),
    key: "", ring: new Uint8Array(W * H), tn: new Uint8Array(H), tx: new Float32Array(H * 8), xl: new Float32Array(H), xr: new Float32Array(H), buf: new Float32Array(W * H * 3),
    c: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], tmp: [0, 0], tmq: [0, 0],
  };
}

// The oval at morph m between oval f and the next one.
function buildOval(S, m) {
  const A = OVALS[S.f % OVALS.length], B = OVALS[(S.f + 1) % OVALS.length], p = S.tmp, q = S.tmq;
  for (let i = 0; i < K; i++) {
    const psi = ((i + 0.5) / K) * TAU, c = cos(psi), s = sin(psi);
    support(A, c, s, p);
    support(B, c, s, q);
    S.ox[i] = CX + p[0] + (q[0] - p[0]) * m;
    S.oy[i] = CY + p[1] + (q[1] - p[1]) * m;
  }
  S.arc[0] = 0;
  for (let i = 1; i <= K; i++) S.arc[i] = S.arc[i - 1] + hypot(S.ox[i % K] - S.ox[i - 1], S.oy[i % K] - S.oy[i - 1]);
  // Start each lap at the top of the oval, normal straight up.
  S.u0 = S.arc[(3 * K) / 4];
  S.ey = A.ey + (B.ey - A.ey) * m;
}

// The point of the oval at arc length u, and the edge it lies on.
function at(S, u, out) {
  const per = S.arc[K];
  u = ((u % per) + per) % per;
  let lo = 0, hi = K;
  while (hi - lo > 1) {
    const md = (lo + hi) >> 1;
    if (S.arc[md] <= u) lo = md;
    else hi = md;
  }
  const f = (u - S.arc[lo]) / (S.arc[lo + 1] - S.arc[lo] || 1), j = (lo + 1) % K;
  out[0] = S.ox[lo] + (S.ox[j] - S.ox[lo]) * f;
  out[1] = S.oy[lo] + (S.oy[j] - S.oy[lo]) * f;
  out[2] = lo;
}

// The other end of the chord: walking on from P, the first point of the
// oval at distance L, solved exactly on the edge where it lies.
function far(S, px, py, edge, L, out) {
  for (let k = 0; k < K; k++) {
    const i = (edge + k) % K, j = (i + 1) % K;
    const ax = k ? S.ox[i] : px, ay = k ? S.oy[i] : py, bx = S.ox[j], by = S.oy[j];
    if (hypot(bx - px, by - py) < L) continue;
    const dx = bx - ax, dy = by - ay, fx = ax - px, fy = ay - py;
    const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - L * L;
    const t = (-b + sqrt(max(0, b * b - 4 * a * c))) / (2 * a);
    out[0] = ax + dx * t;
    out[1] = ay + dy * t;
    return;
  }
}

// N + 1 chord positions round the lap: P, the split point D, the chord's
// angle unwrapped, and the area the a-part has swept so far, quad by quad.
function sampleLap(S, sp, L) {
  const p = [0, 0, 0], q = [0, 0], per = S.arc[K], X = S.sx;
  let prev = 0;
  for (let k = 0; k <= N; k++) {
    at(S, S.u0 + (k / N) * per, p);
    far(S, p[0], p[1], p[2], L, q);
    X[k * 4] = p[0];
    X[k * 4 + 1] = p[1];
    X[k * 4 + 2] = p[0] + (q[0] - p[0]) * sp;
    X[k * 4 + 3] = p[1] + (q[1] - p[1]) * sp;
    let an = atan2(q[1] - p[1], q[0] - p[0]);
    if (k) {
      while (an - prev > PI) an -= TAU;
      while (an - prev < -PI) an += TAU;
    }
    S.ang[k] = prev = an;
    S.area[k] = k ? S.area[k - 1] + quadArea(X, k - 1) : 0;
  }
  S.dir = S.ang[N] > S.ang[0] ? 1 : -1;
  // The last quad meets the first again, so the a-part has swept the ring
  // once: the total is pi a b to a few parts in ten thousand.
  S.total = abs(S.area[N]);
}

function quadArea(X, k) {
  const a = k * 4, b = a + 4;
  const px = [X[a], X[a + 2], X[b + 2], X[b]], py = [X[a + 1], X[a + 3], X[b + 3], X[b + 1]];
  let s = 0;
  for (let i = 0; i < 4; i++) s += px[i] * py[(i + 1) % 4] - px[(i + 1) % 4] * py[i];
  return s / 2;
}

// Marks the LED centres inside triangle a b c with v.
function tri(M, ax, ay, bx, by, cx, cy, v) {
  const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (abs(d) < 1e-9) return;
  const x0 = max(0, floor(min(ax, bx, cx))), x1 = min(W - 1, ceil(max(ax, bx, cx)));
  const y0 = max(0, floor(min(ay, by, cy))), y1 = min(H - 1, ceil(max(ay, by, cy)));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l0 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / d, l1 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / d;
      if (l0 >= -1e-6 && l1 >= -1e-6 && 1 - l0 - l1 >= -1e-6) {
        const o = y * W + x;
        if (M[o] < v) M[o] = v;
      }
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.25, 36], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.sp = cl(kv[2], 0.25, 0.5);
  S.L = cl(kv[3], 36, 44);
  S.t += (d * cl(kv[1], 0.2, 3)) / 2;
  if (S.t >= LAP + HOLD + MORPH) (S.t -= LAP + HOLD + MORPH), S.f++;
  const m = ss(LAP + HOLD, LAP + HOLD + MORPH, S.t);
  // The lap is worked out again only when the oval or a knob has moved.
  const key = S.f + "," + m.toFixed(4) + "," + S.sp.toFixed(4) + "," + S.L.toFixed(3);
  if (key !== S.key) {
    S.key = key;
    buildOval(S, m);
    sampleLap(S, S.sp, S.L);
  }
}

// Xiaolin Wu's line, mixed over what is there.
function line(B, x0, y0, x1, y1, c, a) {
  const steep = abs(y1 - y0) > abs(x1 - x0);
  let t;
  if (steep) (t = x0), (x0 = y0), (y0 = t), (t = x1), (x1 = y1), (y1 = t);
  if (x0 > x1) (t = x0), (x0 = x1), (x1 = t), (t = y0), (y0 = y1), (y1 = t);
  const k = (y1 - y0) / (x1 - x0 || 1e-9);
  for (let u = ceil(x0 - 0.5); u <= floor(x1 - 0.5); u++) {
    const v = y0 + k * (u + 0.5 - x0) - 0.5, vi = floor(v), f = v - vi;
    plot(B, steep ? vi : u, steep ? u : vi, c, a * (1 - f));
    plot(B, steep ? vi + 1 : u, steep ? u : vi + 1, c, a * f);
  }
}

function plot(B, x, y, c, a) {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  const o = (y * W + x) * 3;
  a = min(1, a);
  B[o] += (c[0] - B[o]) * a;
  B[o + 1] += (c[1] - B[o + 1]) * a;
  B[o + 2] += (c[2] - B[o + 2]) * a;
}

function dot(B, x, y, r, c, a) {
  for (let yy = floor(y - r); yy <= y + r; yy++)
    for (let xx = floor(x - r); xx <= x + r; xx++) {
      const q = hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
      if (q < 1) plot(B, xx, yy, c, a * min(1, 1.6 * (1 - q)));
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.key) return;
  const B = S.buf, X = S.sx, M = S.ring, t = S.t, [cBase, cOval, cFill, cTrace, cA, cB] = S.c, h = S.hue;
  hsv(wheel(0.43 + h), 0.25, 0.11, cBase);
  hsv(0.53 + h, 0.45, 1, cOval);
  hsv(wheel(0.73 + h), 0.7, 0.6, cFill);
  hsv(0.13 + h, 0.65, 1, cTrace);
  hsv(wheel(0.73 + h), 0.35, 1, cA);
  hsv(0.53 + h, 0.1, 0.9, cB);
  // How far round the lap the chord is, and how bright the fills are: they
  // pulse together in the hold and sink back to a ghost at the end of the
  // morph, ready for the next lap to fill them again.
  const lap = cl(t / LAP, 0, 1), kf = lap * N, k = min(N - 1, floor(kf)), fr = kf - k;
  const full = t >= LAP, pulse = full ? 1 + 0.25 * sin((PI * (t - LAP)) / HOLD) * (t < LAP + HOLD ? 1 : 0) : 1;
  const sink = ss(LAP + HOLD + MORPH - 0.5, LAP + HOLD + MORPH, t), lit = (full ? 1 - sink * 0.65 : 1) * pulse, ghost = 0.35;
  // The chord now, exactly, between sample k and k + 1.
  const p = [0, 0, 0], q = [0, 0];
  at(S, S.u0 + lap * S.arc[K], p);
  far(S, p[0], p[1], p[2], S.L, q);
  const sp = S.sp, dx = p[0] + (q[0] - p[0]) * sp, dy = p[1] + (q[1] - p[1]) * sp;
  // The ring is what lies inside the oval and outside the trace. M marks
  // the LEDs the a-part has swept so far, quad by quad. With a < b the
  // a-part can dip a little inside the trace and come back out; that part
  // counts once forward and once back, so it is no part of the ring.
  M.fill(0);
  for (let i = 0; i < (full ? N : k); i++) {
    const a = i * 4, b = a + 4;
    tri(M, X[a], X[a + 1], X[a + 2], X[a + 3], X[b + 2], X[b + 3], 2);
    tri(M, X[a], X[a + 1], X[b + 2], X[b + 3], X[b], X[b + 1], 2);
  }
  if (!full) {
    const a = k * 4;
    tri(M, X[a], X[a + 1], X[a + 2], X[a + 3], dx, dy, 2);
    tri(M, X[a], X[a + 1], dx, dy, p[0], p[1], 2);
  }
  // The ellipse fills as a sector with the area the ring has so far:
  // parametric angle 2 A / (a b), which comes to 2 pi as the lap closes.
  const ea = sp * S.L, eb = S.L - ea, ecx = CX, ecy = S.ey;
  const swept = full ? S.total : abs(S.area[k] + (S.area[k + 1] - S.area[k]) * fr);
  const phi = full ? TAU : min(TAU, (2 * swept) / (ea * eb)), a0 = S.ang[0], dir = S.dir;
  // Row by row, where the oval starts and ends.
  const xl = S.xl.fill(1e9), xr = S.xr.fill(-1e9);
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K, y0 = S.oy[i], y1 = S.oy[j];
    for (let y = ceil(min(y0, y1) - 0.5); y <= floor(max(y0, y1) - 0.5); y++) {
      if (y < 0 || y >= H || y0 === y1) continue;
      const x = S.ox[i] + ((S.ox[j] - S.ox[i]) * (y + 0.5 - y0)) / (y1 - y0);
      if (x < xl[y]) xl[y] = x;
      if (x > xr[y]) xr[y] = x;
    }
  }
  // Where the whole trace crosses each row, for an inside test by parity.
  const tn = S.tn.fill(0), tx = S.tx;
  for (let i = 0; i < N; i++) {
    const x0 = X[i * 4 + 2], y0 = X[i * 4 + 3], x1 = X[i * 4 + 6], y1 = X[i * 4 + 7];
    for (let y = max(0, ceil(min(y0, y1) - 0.5)); y <= min(H - 1, floor(max(y0, y1) - 0.5)); y++) {
      const yc = y + 0.5;
      if (yc >= y0 === yc >= y1 || tn[y] >= 8) continue;
      tx[y * 8 + tn[y]++] = x0 + ((x1 - x0) * (yc - y0)) / (y1 - y0);
    }
  }
  B.fill(0);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const cov = cl(x + 1 - xl[y], 0, 1) * cl(xr[y] - x, 0, 1);
      if (cov <= 0) continue;
      let r = cBase[0], g = cBase[1], b = cBase[2], f = 0, inT = 0;
      for (let c = 0; c < tn[y]; c++) if (tx[y * 8 + c] < x + 0.5) inT ^= 1;
      if (!inT) f = M[o] ? lit : ghost;
      const u = (x + 0.5 - ecx) / ea, v = (y + 0.5 - ecy) / eb;
      if (u * u + v * v <= 1) {
        const beta = atan2(v, u);
        f = (((dir * (beta - a0)) % TAU) + TAU) % TAU <= phi ? lit : ghost;
      }
      (r += cFill[0] * f), (g += cFill[1] * f), (b += cFill[2] * f);
      B[o * 3] = r * cov;
      B[o * 3 + 1] = g * cov;
      B[o * 3 + 2] = b * cov;
    }
  // The ellipse's rim, faint, and its hand at the parametric angle reached.
  for (let i = 0; i < 96; i++) {
    const a1 = (i / 96) * TAU, a2 = ((i + 1) / 96) * TAU;
    line(B, ecx + ea * cos(a1), ecy + eb * sin(a1), ecx + ea * cos(a2), ecy + eb * sin(a2), cA, 0.45);
  }
  const ha = a0 + dir * phi, hx = ecx + ea * cos(ha), hy = ecy + eb * sin(ha);
  line(B, ecx, ecy, hx, hy, cA, 0.9);
  // Every eighth chord of the lap so far, faint, and a tail of the last 36
  // behind the chord, fading.
  for (let i = 0; i < (full ? N : k); i++) {
    let al = i % 8 ? 0 : 0.16;
    if (!full && k - i < 36 && i % 3 === 0) al = max(al, 0.45 * (1 - (k - i) / 36));
    if (al <= 0) continue;
    const a = i * 4, px = X[a], py = X[a + 1];
    line(B, px, py, px + (X[a + 2] - px) / sp, py + (X[a + 3] - py) / sp, cB, al);
  }
  // The oval.
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K;
    line(B, S.ox[i], S.oy[i], S.ox[j], S.oy[j], cOval, 0.95);
  }
  // The trace of the split point, as far as the chord has gone.
  const kk = full ? N : k;
  for (let i = 0; i < kk; i++) line(B, X[i * 4 + 2], X[i * 4 + 3], X[i * 4 + 6], X[i * 4 + 7], cTrace, 1);
  if (!full) line(B, X[k * 4 + 2], X[k * 4 + 3], dx, dy, cTrace, 1);
  // The chord: the a-part in the fill's colour, the b-part white.
  line(B, p[0], p[1], dx, dy, cA, 1);
  line(B, dx, dy, q[0], q[1], cB, 1);
  dot(B, p[0], p[1], 1.6, cB, 1);
  dot(B, q[0], q[1], 1.6, cB, 1);
  dot(B, dx, dy, 2, cTrace, 1);
  dot(B, hx, hy, 1.8, cTrace, 1);
  for (let i = 0, o = 0; i < W * H; i++, o += 3)
    display.setPixel(i % W, (i / W) | 0, min(255, B[o] * 255) | 0, min(255, B[o + 1] * 255) | 0, min(255, B[o + 2] * 255) | 0);
}
