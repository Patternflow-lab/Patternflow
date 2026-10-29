// ===== Patternflow pattern =====
// Title:   Moffatt Eddies
// Family:  sim
// Idea:    A wedge of syrup stands on its point, stirred far above, and Moffatt's similarity solution fills it with a stack of counter-rotating eddies that shrink by a fixed ratio toward the corner, each one drawn with its own stream lines on its own log scale between white dividing stream lines, with tracers circling in every eddy while the view sinks into the corner one eddy at a time.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Moffatt eddies in a corner (H. Keith Moffatt, 1964), their photograph (Sadatoshi Taneda, 1979), pattern round 63
// Round:   63
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Angle=28..100, Truth=0..1
//
// Knob 1: Hue. Turns the two eddy colours together along the hues from green to pink, leaving out red, orange and yellow, which read brown this dim: at 0 the eddies turning one way are teal and the ones turning the other way violet, at 0.4 violet and green, at 0.6 magenta and sky blue. The dividing stream lines stay white and the walls grey.
// Knob 2: Speed. At 2 the view sinks into the corner by one eddy every 3.0 s at 28 degrees (6.6 s at 100), and a tracer goes round its stream line in 1.6 to 2.3 s whatever the size of its eddy. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Angle. The wedge's opening 2 alpha, from 28 degrees, where its walls meet the panel's top corners, to 100. The exponent lambda solves sin(2 (lambda - 1) alpha) = -(lambda - 1) sin(2 alpha): at 28 degrees lambda = 9.636 + 4.516i and each eddy is 2.005 times smaller than the one above it and its fluid moves 406 times slower; at 60 degrees 5.000 and 688, at 90 16.57 and 2189, at 100 29.27 and 4322, when one eddy fills the panel. Past 146.3 degrees lambda turns real and the eddies are gone.
// Knob 4: Truth. At 0 every eddy is drawn and turned on its own scale, so the deep ones still glow and turn. Turned up, brightness and turning follow the real flow: at 1 brightness is the log of the speed over three decades below an eddy whose outer edge is at the top of the panel. At 28 degrees an eddy brightens from 0.13 to full as its outer edge climbs from row 66 to the top, the eddy under it stays dark, and its tracers turn 203 times slower than the ones above. That is about what Taneda's camera saw.

const W = 64, H = 128;
const { floor, min, max, abs, exp, log, sqrt, sin, cos, sinh, cosh, atan2, atan, PI, random, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const frac = (v) => v - floor(v);
const CX = 32, CY = 128; // the corner, at the middle of the bottom edge
const TN = 513; // samples of the angular profile across the wedge
const NP = 64; // tracers
const TL = 9; // trail points per tracer

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// cos and sin of a complex number x + iy, as [re, im].
const ccos = (x, y) => [cos(x) * cosh(y), -sin(x) * sinh(y)];
const csin = (x, y) => [sin(x) * cosh(y), cos(x) * sinh(y)];

// Stokes flow in the wedge |theta| < alpha with psi even in theta, so the
// fluid crosses the bisector: psi = Re[r^lambda f(theta)] with
// f = A cos(lambda theta) + C cos((lambda - 2) theta). No slip on both walls
// (f = f' = 0 at theta = alpha) leaves a 2x2 system whose determinant,
// (l - 2) cos(l a) sin((l - 2) a) - l sin(l a) cos((l - 2) a), reduces to
// sin(2 (l - 1) a) + (l - 1) sin(2 a) = 0. Newton on p = l - 1, followed
// from a 2 degree wedge, where 2 p a is near the root 4.2124 + 2.2507i of
// sin z = -z, up to the wedge asked for.
function solve(S, deg) {
  let from = S.deg, pr = S.pr, pi = S.pi;
  if (!(from > 0) || abs(deg - from) > 60) {
    from = 2;
    const a0 = (PI / 180) * 1;
    pr = 4.212392 / (2 * a0); pi = 2.250729 / (2 * a0);
  }
  const steps = max(1, Math.ceil(abs(deg - from) / 1));
  for (let s = 1; s <= steps; s++) {
    const d = from + ((deg - from) * s) / steps, a = (PI / 180) * d * 0.5, s2 = sin(2 * a);
    for (let it = 0; it < 30; it++) {
      const [sr, si] = csin(2 * a * pr, 2 * a * pi), [cr, ci] = ccos(2 * a * pr, 2 * a * pi);
      const fr = sr + pr * s2, fi = si + pi * s2, dr = 2 * a * cr + s2, di = 2 * a * ci;
      const dd = dr * dr + di * di;
      const qr = (fr * dr + fi * di) / dd, qi = (fi * dr - fr * di) / dd;
      pr -= qr; pi -= qi;
      if (abs(qr) + abs(qi) < 1e-12) break;
    }
  }
  S.deg = deg; S.pr = pr; S.pi = pi;
  const al = (PI / 180) * deg * 0.5, lr = pr + 1, li = pi;
  S.al = al; S.a = lr; S.mu = li; S.c = lr / li;
  // Each eddy is rho times the next one in, and its speeds exp(pi (a - 1) / mu) times.
  S.rho = exp(PI / li);
  // The angular profile: f = cos((l-2) a) cos(l t) - cos(l a) cos((l-2) t).
  const [Ar, Ai] = ccos((lr - 2) * al, li * al), [Cr, Ci] = ccos(lr * al, li * al);
  let prev = 0;
  for (let j = 0; j < TN; j++) {
    const t = -al + (2 * al * j) / (TN - 1);
    const [xr, xi] = ccos(lr * t, li * t), [yr, yi] = ccos((lr - 2) * t, li * t);
    const fr = Ar * xr - Ai * xi - (Cr * yr - Ci * yi), fi = Ar * xi + Ai * xr - (Cr * yi + Ci * yr);
    let g = atan2(fi, fr);
    if (j > 0) { while (g - prev > PI) g -= 2 * PI; while (g - prev < -PI) g += 2 * PI; }
    prev = g;
    S.arg[j] = g;
    S.lf[j] = 0.5 * log(fr * fr + fi * fi + 1e-300);
  }
  const off = S.arg[(TN - 1) >> 1];
  for (let j = 0; j < TN; j++) {
    S.arg[j] -= off;
    S.G[j] = S.lf[j] - S.c * S.arg[j];
  }
  for (let j = 1; j < TN - 1; j++) S.da[j] = (S.arg[j + 1] - S.arg[j - 1]) / ((4 * al) / (TN - 1));
  S.da[0] = S.da[1]; S.da[TN - 1] = S.da[TN - 2];
  // ln u = G(t) + c x + ln sin x - ln m, x in [0, pi) across one eddy; the
  // largest e^(c x) sin x is at x = pi - atan(1/c).
  const xs = PI - atan(1 / S.c);
  let gm = -1e9;
  for (let j = 0; j < TN; j++) gm = max(gm, S.G[j]);
  S.lnm = gm + S.c * xs + log(sin(xs));
}

// The field at a screen point, into q: inside, the eddy index k, xh (0..pi
// across the eddy), lu (ln of |psi| over the eddy's own scale, so the same
// numbers in every eddy) and gc, the length of grad chi in 1/LED.
function field(S, x, y, q) {
  const dx = x - CX, dy = CY - y, r = hypot(dx, dy), t = atan2(dx, dy);
  q.r = r; q.t = t;
  if (r < 1e-6 || abs(t) >= S.al) { q.inside = 0; return q; }
  const fj = ((t + S.al) / (2 * S.al)) * (TN - 1), j = min(TN - 2, floor(fj)), w = fj - j;
  const arg = S.arg[j] + (S.arg[j + 1] - S.arg[j]) * w;
  const G = S.G[j] + (S.G[j + 1] - S.G[j]) * w;
  const da = S.da[j] + (S.da[j + 1] - S.da[j]) * w;
  const chi = S.mu * log(r) + arg + S.phi;
  const k = floor((chi - PI / 2) / PI), xh = chi - PI / 2 - k * PI;
  q.inside = 1; q.k = k; q.xh = xh;
  q.lu = G + S.c * xh + log(max(1e-30, sin(xh))) - S.lnm;
  q.gc = sqrt(S.mu * S.mu + da * da) / r;
  return q;
}

export function setup(params) {
  params.s = {
    arg: new Float64Array(TN), lf: new Float64Array(TN), G: new Float64Array(TN), da: new Float64Array(TN),
    deg: 0, pr: 0, pi: 0, al: 0, a: 0, mu: 1, c: 1, rho: 1, lnm: 0,
    phi: 0, hue: 0, truth: 0, speed: 2, kap: 0, spin: 1,
    px: new Float32Array(NP), py: new Float32Array(NP), pu: new Float32Array(NP), pk: new Int32Array(NP),
    tx: new Float32Array(NP * TL), ty: new Float32Array(NP * TL), tick: 0,
    q: {}, q2: {}, rgb: new Float32Array(W * H * 3), col: [0, 0, 0],
    K: new Float64Array(W * H), LU: new Float32Array(W * H), TH: new Float32Array(W * H), DM: new Float32Array(W * H),
  };
}

// A tracer on a random stream line. Fresh tracers spread over every eddy
// from the newest one at least 5 LEDs across up to the top of the panel; a
// tracer whose eddy has left the panel comes back in one of them, picked by
// size, so the big eddies near the top keep enough tracers.
function spawn(S, i, deep) {
  const q = S.q, size = min(S.rho - 1, 2 * sin(S.al));
  const k0 = Math.ceil((S.mu * log(5 / size) - PI / 2 + S.phi) / PI);
  const k1 = floor((S.mu * log(124) - PI / 2 + S.phi) / PI);
  for (let tries = 0; tries < 40; tries++) {
    let k = k0 + floor(random() * (max(k0, k1) - k0 + 1));
    if (deep) for (let kk = k1, tot = 0; kk >= k0; kk--) {
      const z = exp((0.8 * (kk - k1) * PI) / S.mu);
      tot += z;
      if (random() * tot < z) k = kk;
    }
    const t = (random() * 2 - 1) * S.al * 0.8, xh = random() * PI;
    const fj = ((t + S.al) / (2 * S.al)) * (TN - 1), j = floor(fj);
    const r = exp((k * PI + PI / 2 + xh - S.arg[j] - S.phi) / S.mu);
    const x = CX + r * sin(t), y = CY - r * cos(t);
    field(S, x, y, q);
    if (!q.inside || q.k !== k || y < 0) continue;
    const u = exp(q.lu);
    if (u < 0.015 || u > 0.85) continue;
    S.px[i] = x; S.py[i] = y; S.pu[i] = u; S.pk[i] = k;
    for (let n = 0; n < TL; n++) { S.tx[i * TL + n] = x; S.ty[i * TL + n] = y; }
    return;
  }
  S.pu[i] = -1;
}

// The tracer velocity: the dive's outward stretch plus the flow along the
// stream lines of eddy k. The flow is scaled by a constant on each stream line,
// so the paths are the real ones, and every stream line of every eddy goes
// round in about the same time (Truth 0) or at its eddy's real rate.
function vel(S, x, y, k, iu, out) {
  const q = S.q2, h = 0.2;
  field(S, x + h, y, q); const ux1 = q.inside && q.k === k ? exp(q.lu) : 0;
  field(S, x - h, y, q); const ux0 = q.inside && q.k === k ? exp(q.lu) : 0;
  field(S, x, y + h, q); const uy1 = q.inside && q.k === k ? exp(q.lu) : 0;
  field(S, x, y - h, q); const uy0 = q.inside && q.k === k ? exp(q.lu) : 0;
  const gx = (ux1 - ux0) / (2 * h), gy = (uy1 - uy0) / (2 * h);
  const R = exp((k * PI + PI - S.phi) / S.mu);
  const slow = exp(-S.truth * (S.a - 2) * max(0, log(120 / R)));
  const sg = k & 1 ? 1 : -1, f = sg * R * R * S.spin * slow * iu;
  out[0] = -gy * f + S.kap * (x - CX);
  out[1] = gx * f + S.kap * (y - CY);
  out[2] = gx; out[3] = gy;
  return out;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0];
  S.speed = cl(kv[1], 0.2, 3);
  S.truth = cl(kv[3], 0, 1);
  const deg = cl(kv[2], 28, 100);
  let fresh = false;
  if (abs(deg - S.deg) > 0.05) { solve(S, deg); fresh = true; }
  // The dive: one eddy grows into the next one's place every T seconds.
  const T = (3 * sqrt(log(S.rho) / log(2))) / (S.speed / 2);
  const om = PI / T;
  S.kap = om / S.mu;
  // A loop takes about 3.2 / (spin mu^2) s, measured from 28 to 100 degrees.
  S.spin = (0.65 * S.speed) / (S.mu * S.mu);
  S.phi -= om * d;
  if (S.phi < -2 * PI) { S.phi += 2 * PI; for (let i = 0; i < NP; i++) S.pk[i] += 2; }
  if (fresh) for (let i = 0; i < NP; i++) spawn(S, i, false);
  const v = [0, 0, 0, 0], v2 = [0, 0, 0, 0], q = S.q;
  for (let i = 0; i < NP; i++) {
    if (S.pu[i] < 0) { spawn(S, i, true); continue; }
    let x = S.px[i], y = S.py[i];
    const k = S.pk[i], iu = 1 / S.pu[i]; // eddies keep their index as the field slides
    vel(S, x, y, k, iu, v);
    const sp = hypot(v[0], v[1]) * d, r = hypot(x - CX, y - CY);
    const n = max(1, min(8, Math.ceil(sp / max(0.3, 0.08 * r))));
    const h = d / n;
    for (let s = 0; s < n; s++) {
      vel(S, x, y, k, iu, v);
      vel(S, x + 0.5 * h * v[0], y + 0.5 * h * v[1], k, iu, v2);
      x += h * v2[0]; y += h * v2[1];
    }
    // Back onto the stream line it started on.
    field(S, x, y, q);
    if (q.inside && q.k === k) {
      vel(S, x, y, k, iu, v);
      const g2 = v[2] * v[2] + v[3] * v[3], e = exp(q.lu) - S.pu[i];
      if (g2 > 1e-9) { x -= (e * v[2]) / g2; y -= (e * v[3]) / g2; }
    }
    field(S, x, y, q);
    const gone = exp((k * PI + PI / 2 - S.phi) / S.mu) > 135;
    if (!q.inside || q.k !== k || gone) { spawn(S, i, true); continue; }
    S.px[i] = x; S.py[i] = y;
  }
  // Trails ride the dive with their tracers.
  const g = exp(S.kap * d);
  for (let n = 0; n < NP * TL; n++) { S.tx[n] = CX + (S.tx[n] - CX) * g; S.ty[n] = CY + (S.ty[n] - CY) * g; }
  S.tick += d;
  if (S.tick > 1 / 30) {
    S.tick = 0;
    for (let i = 0; i < NP; i++) {
      for (let n = TL - 1; n > 0; n--) { S.tx[i * TL + n] = S.tx[i * TL + n - 1]; S.ty[i * TL + n] = S.ty[i * TL + n - 1]; }
      S.tx[i * TL] = S.px[i]; S.ty[i * TL] = S.py[i];
    }
  }
}

function splat(rgb, x, y, r, g, b) {
  const x0 = floor(x - 0.5), y0 = floor(y - 0.5), fx = x - 0.5 - x0, fy = y - 0.5 - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const X = x0 + i, Y = y0 + j;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), p = (Y * W + X) * 3;
      rgb[p] = max(rgb[p], r * w * 1.6); rgb[p + 1] = max(rgb[p + 1], g * w * 1.6); rgb[p + 2] = max(rgb[p + 2], b * w * 1.6);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.deg) return;
  const rgb = S.rgb, q = S.q, c = S.col;
  // Two hues apart on a wheel from green to pink, without the red, orange and
  // yellow that read brown when dim: teal and violet at 0.
  const hA = 0.3 + 0.64 * frac(0.266 + S.hue), hB = 0.3 + 0.64 * frac(0.781 + S.hue);
  const K = S.K, LU = S.LU, TH = S.TH, DM = S.DM;
  const top = log(124), span = S.c * PI, deep = 3 * log(10);
  const lev = (lu) => (lu > -0.3 ? 0 : lu > -1 ? 1 : lu > -2.1 ? 2 : lu > -3.6 ? 3 : lu > -5.6 ? 4 : 5);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      field(S, x + 0.5, y + 0.5, q);
      if (!q.inside) { K[p] = -1e9; continue; }
      K[p] = q.k; LU[p] = q.lu; TH[p] = PI / q.gc;
      // Truth: how far the real speed in this eddy sits below the speed in an
      // eddy whose outer edge is at the top of the panel, over three decades.
      const o = (S.a - 1) * min(0, (q.k * PI + 1.5 * PI - S.phi) / S.mu - top);
      DM[p] = cl(1 + (S.truth * o) / deep, 0, 1);
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, o = p * 3;
      if (K[p] === -1e9) {
        const dx = x + 0.5 - CX, dy = CY - y - 0.5, r = hypot(dx, dy);
        const e = abs(atan2(dx, dy)) - S.al, dw = r * sin(e), sw = r * cos(e);
        // The solid: the wall line and a band of hatching behind it.
        const hm = dw < 6 && ((sw + dw) % 4 + 4) % 4 < 1 ? 0.2 * (1 - dw / 6) : 0;
        rgb[o] = rgb[o + 1] = rgb[o + 2] = max(cl(1 - dw, 0, 1) * 0.5, hm);
        continue;
      }
      const k = K[p], lu = LU[p], th = TH[p], dm = DM[p];
      const b = cl(1 + lu / span, 0, 1);
      const hue = k & 1 ? hB : hA;
      let sep = 0, ring = 0;
      const n = lev(lu);
      for (let e = 0; e < 4; e++) {
        const X = x + (e === 0 ? 1 : e === 1 ? -1 : 0), Y = y + (e === 2 ? 1 : e === 3 ? -1 : 0);
        if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
        const pp = Y * W + X;
        if (K[pp] === -1e9) continue;
        if (K[pp] !== k) sep = 1;
        else if (n < 5 && lev(LU[pp]) > n) ring = 1;
      }
      sep *= cl((th - 2) / 4, 0, 1);
      ring *= cl((th - 8) / 10, 0, 1);
      hsv(hue, 0.9 - 0.35 * ring, dm * (0.12 + 0.25 * b + 0.5 * ring), c);
      const dx = x + 0.5 - CX, dy = CY - y - 0.5, r = hypot(dx, dy);
      const dw = r * sin(S.al - abs(atan2(dx, dy))), wl = cl(1 - dw, 0, 1) * 0.5;
      const sv = sep * (0.35 + 0.55 * dm);
      rgb[o] = max(c[0] + sv, wl); rgb[o + 1] = max(c[1] + sv, wl); rgb[o + 2] = max(c[2] + sv, wl);
    }
  for (let i = 0; i < NP; i++) {
    if (S.pu[i] < 0) continue;
    const dm = cl(1 + (S.truth * (S.a - 1) * min(0, (S.pk[i] * PI + 1.5 * PI - S.phi) / S.mu - top)) / deep, 0, 1);
    for (let n = TL - 1; n > 0; n--) {
      const b = dm * 0.7 * (1 - n / TL);
      splat(rgb, S.tx[i * TL + n], S.ty[i * TL + n], b, b, b);
    }
    const X = floor(S.px[i]), Y = floor(S.py[i]);
    if (X >= 0 && X < W && Y >= 0 && Y < H) { const o = (Y * W + X) * 3; rgb[o] = rgb[o + 1] = rgb[o + 2] = max(rgb[o], dm); }
  }
  for (let p = 0; p < W * H; p++) {
    const o = p * 3;
    display.setPixel(p & 63, p >> 6, floor(cl(rgb[o], 0, 1) * 255), floor(cl(rgb[o + 1], 0, 1) * 255), floor(cl(rgb[o + 2], 0, 1) * 255));
  }
}
