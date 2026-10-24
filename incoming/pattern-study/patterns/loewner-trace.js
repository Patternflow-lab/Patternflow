// ===== Patternflow pattern =====
// Title:   Loewner Trace
// Family:  line
// Idea:    A Schramm-Loewner curve driven by Brownian motion climbs a channel as wide as the panel, and the conformal grid of the map that unzips it bends round its tip.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Schramm-Loewner evolution (Oded Schramm, 2000) grown with Loewner's equation (Charles Loewner, 1923), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Kappa=4..8, Trace=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the grid is blue and teal and the trace runs from white-gold at the tip through orange and rose to violet as it ages.
// Knob 2: Speed. Loewner steps a second, 1200 at 2. The tip passes the middle of the panel in two and a half seconds, then climbs 17 to 24 LEDs a second, fastest at Kappa 4, and the view scrolls after it. At 0.2 everything runs ten times slower.
// Knob 3: Kappa. The kappa of SLE, how hard the Brownian motion drives the curve. At 4 the curve is simple and never touches itself or the walls. Above 4 it hits both, and the ground it closes off is swallowed and hatched in the colour of the moment it was cut off. At 8 it fills everything behind the tip.
// Knob 4: Trace. Fades the grid out from behind the trace. At 0 the conformal grid lights the channel round the curve; at 1 it is gone and the trace burns on black.
// Buttons: K1 tap starts a fresh Brownian path from the floor of the channel.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, log, atan2, exp, abs, sin, cos, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The panel is a half-strip of the plane 65 LEDs wide, its walls and floor
// one LED beyond the outer LEDs so that none sits on the boundary. sin()
// carries the half-strip onto the upper half-plane, where the Loewner
// equation lives: the floor goes to [-1, 1], the walls to the rest of the
// real line, and the top of the channel, however far it scrolls, to
// infinity. Each row up the channel is a factor e^(pi/65) further out.
// Scale invariance of SLE makes that a channel the curve climbs for ever.
const PX = PI / 65;
const M = 12; // Laurent terms of g_t at infinity, for rows that scroll in
const CAP = 1 << 16; // steps of driving function kept for the tip
const BACK = 6000; // steps walked back when finding the tip
const V = 0.025; // LEDs the curve climbs a step, on average
const RATE = 600; // steps a second at Speed 1
const NEAR = 0.6; // an LED this close to the curve is the curve
const KNEAR = 0.1; // the next slit against the w-distance of the LED nearest the tip
const TIPROW = 52; // the view scrolls to keep the tip at least this far down

function zOf(s, x, py) {
  const xi = (x - 31.5) * PX, eta = (127 - py + 1 + s.scroll) * PX;
  const a = exp(eta - s.lnL) * 0.5, b = exp(-eta - s.lnL) * 0.5, il = exp(-s.lnL);
  const ch = a + b, sh = a - b, c = cos(xi);
  return [sin(xi) * ch, c * sh, PX * sqrt(c * c * il * il + sh * sh)];
}

function fresh(s) {
  s.scroll = 0;
  s.lnL = 0;
  s.t = 0;
  s.Wd = 0;
  s.n = 0;
  s.tau = 0;
  s.near = Infinity;
  s.b.fill(0);
  s.mk.fill(0);
  for (let py = 0, p = 0; py < H; py++)
    for (let x = 0; x < W; x++, p++) {
      const [zx, zy, S] = zOf(s, x, py);
      s.wx[p] = zx;
      s.wy[p] = zy;
      s.d2[p] = S * S;
    }
  s.tipx = 31.5;
  s.tipy = 128;
}

function gauss(s) {
  if (s.spare !== null) {
    const g = s.spare;
    s.spare = null;
    return g;
  }
  let u = Math.random();
  if (u < 1e-12) u = 1e-12;
  const r = sqrt(-2 * log(u)), a = 2 * PI * Math.random();
  s.spare = r * sin(a);
  return r * cos(a);
}

// One Loewner step: the driving point jumps, then a vertical slit of
// half-plane capacity 2 dt grows at it. Every LED's g_t(z) goes through the
// slit map w -> W + sqrt((w - W)^2 + 4 dt), and so do the Laurent
// coefficients of g_t at infinity.
function step(s, kappa) {
  const il2 = exp(-2 * s.lnL), t = s.t;
  const base = V * PX * sqrt((t + 0.25 * PX * PX * il2) * (il2 + 4 * t));
  // Where the tip sits in a sheltered passage a small slit at W unrolls
  // into a long arc on the panel; the LEDs closest to the tip in the
  // w-plane say how small the next slit must be to stay within one of them.
  const dt = max(base * 0.02, min(base, s.near * KNEAR));
  s.Wd += sqrt(kappa * dt) * gauss(s);
  const Wk = s.Wd, c4 = 4 * dt, wx = s.wx, wy = s.wy, d2 = s.d2, mk = s.mk, mt = s.mt, tau = s.tau;
  const near2 = NEAR * NEAR;
  let mmin = Infinity;
  for (let p = 0; p < N; p++) {
    if (mk[p]) continue;
    const ux = wx[p] - Wk, uy = wy[p];
    const a = ux * ux - uy * uy + c4, b = 2 * ux * uy, m = sqrt(a * a + b * b);
    let re, im;
    if (a >= 0) {
      re = sqrt((m + a) * 0.5);
      im = b / (2 * re);
    } else {
      im = sqrt((m - a) * 0.5);
      re = abs(b) / (2 * im);
      if (b < 0) im = -im;
    }
    if (ux < 0) (re = -re), (im = -im);
    wx[p] = Wk + re;
    wy[p] = im;
    if (m < mmin) mmin = m;
    const g = (d2[p] *= (ux * ux + uy * uy) / m);
    if (im * im < near2 * g) (mk[p] = 1), (mt[p] = tau);
  }
  s.near = mmin;
  // Laurent coefficients: g = z (1 + sum V_k z^-k), V_1 = -W, V_k = b_{k-1}.
  const Vc = s.Vc, P = s.P, Q = s.Q, bb = s.b;
  Vc[0] = 1;
  Vc[1] = -Wk;
  for (let k = 2; k <= M + 1; k++) Vc[k] = bb[k - 1];
  for (let k = 0; k <= M + 1; k++) {
    let acc = 0;
    for (let j = 0; j <= k; j++) acc += Vc[j] * Vc[k - j];
    P[k] = acc + (k === 2 ? c4 : 0);
  }
  Q[0] = 1;
  for (let k = 1; k <= M + 1; k++) {
    let acc = P[k];
    for (let j = 1; j < k; j++) acc -= Q[j] * Q[k - j];
    Q[k] = acc * 0.5;
  }
  for (let n = 1; n <= M; n++) bb[n] = Q[n + 1];
  if (s.n === CAP) {
    s.hw.copyWithin(0, CAP / 2);
    s.ht.copyWithin(0, CAP / 2);
    s.n = CAP / 2;
  }
  s.hw[s.n] = Wk;
  s.ht[s.n] = dt;
  s.n++;
  s.t = t + dt;
}

// For kappa above 4 the curve hits itself and the walls, and whatever it
// closes off from the top of the channel leaves the domain: an LED no path
// of open LEDs joins to the top row is swallowed. At 4 and below SLE is a
// simple curve that touches nothing, so nothing is filled there, even where
// two strands pass within an LED of each other.
function fill(s) {
  const mk = s.mk, seen = s.seen, st = s.stack;
  seen.fill(0);
  let top = 0;
  for (let x = 0; x < W; x++) if (!mk[x]) (seen[x] = 1), (st[top++] = x);
  while (top) {
    const p = st[--top], x = p % W;
    if (x > 0 && !mk[p - 1] && !seen[p - 1]) (seen[p - 1] = 1), (st[top++] = p - 1);
    if (x < W - 1 && !mk[p + 1] && !seen[p + 1]) (seen[p + 1] = 1), (st[top++] = p + 1);
    if (p >= W && !mk[p - W] && !seen[p - W]) (seen[p - W] = 1), (st[top++] = p - W);
    if (p < N - W && !mk[p + W] && !seen[p + W]) (seen[p + W] = 1), (st[top++] = p + W);
  }
  for (let p = 0; p < N; p++) if (!mk[p] && !seen[p]) (mk[p] = 2), (s.mt[p] = s.tau);
}

// The tip, g_t^{-1}(W_t): the slit maps undone newest first.
function tip(s) {
  const n = s.n;
  if (!n) return [0, 0];
  let zx = s.hw[n - 1], zy = 2 * sqrt(s.ht[n - 1]), T = s.t - s.ht[n - 1];
  const stop = max(0, n - BACK);
  for (let k = n - 2; k >= stop; k--) {
    const Wk = s.hw[k], c4 = 4 * s.ht[k];
    T -= s.ht[k];
    const ux = zx - Wk, uy = zy;
    const a = ux * ux - uy * uy - c4, b = 2 * ux * uy, m = sqrt(a * a + b * b);
    let re, im;
    if (a >= 0) {
      re = sqrt((m + a) * 0.5);
      im = re > 0 ? b / (2 * re) : 0;
    } else {
      im = sqrt((m - a) * 0.5);
      re = abs(b) / (2 * im);
      if (b < 0) im = -im;
    }
    if (ux < 0) (re = -re), (im = -im);
    zx = Wk + re;
    zy = im;
  }
  // Whatever lies further back is small beside the tip: g^{-1}(w) ~ w - 2T/w.
  if (stop > 0 && T > 0) {
    const r2 = zx * zx + zy * zy;
    zx -= (2 * T * zx) / r2;
    zy += (2 * T * zy) / r2;
  }
  return [zx, zy];
}

// Where a point of the half-plane sits on the panel: arcsin back to the strip.
function toPanel(s, zx, zy) {
  const il2 = exp(-2 * s.lnL);
  // q = -i z + sqrt(1/L^2 - z^2), the root of larger modulus.
  const ax = il2 - (zx * zx - zy * zy), ay = -2 * zx * zy, m = sqrt(ax * ax + ay * ay);
  let rx, ry;
  if (ax >= 0) (rx = sqrt((m + ax) * 0.5)), (ry = rx > 0 ? ay / (2 * rx) : 0);
  else (ry = sqrt((m - ax) * 0.5)), (rx = abs(ay) / (2 * ry)), (ry = ay < 0 ? -ry : ry);
  let qx = zy + rx, qy = -zx + ry;
  const q2x = zy - rx, q2y = -zx - ry;
  if (q2x * q2x + q2y * q2y > qx * qx + qy * qy) (qx = q2x), (qy = q2y);
  const xi = -atan2(qy, qx), eta = s.lnL + 0.5 * log(qx * qx + qy * qy);
  return [xi / PX + 31.5, 128 + s.scroll - eta / PX];
}

// A row scrolling in at the top, far above the hull, takes g_t from its
// Laurent series at infinity.
function newRow(s) {
  const wx = s.wx, wy = s.wy, d2 = s.d2, mk = s.mk, bb = s.b;
  wx.copyWithin(W, 0, N - W);
  wy.copyWithin(W, 0, N - W);
  d2.copyWithin(W, 0, N - W);
  mk.copyWithin(W, 0, N - W);
  s.mt.copyWithin(W, 0, N - W);
  s.scroll++;
  for (let x = 0; x < W; x++) {
    const [zx, zy, S] = zOf(s, x, 0);
    const r2 = zx * zx + zy * zy, yx = zx / r2, yy = -zy / r2;
    // sum b_n y^n and sum n b_n y^(n-1) by Horner.
    let fx = bb[M], fy = 0, dx = M * bb[M], dy = 0;
    for (let n = M - 1; n >= 1; n--) {
      const tx = fx * yx - fy * yy + bb[n];
      fy = fx * yy + fy * yx;
      fx = tx;
      const ex = dx * yx - dy * yy + n * bb[n];
      dy = dx * yy + dy * yx;
      dx = ex;
    }
    const gx = fx * yx - fy * yy, gy = fx * yy + fy * yx;
    const y2x = yx * yx - yy * yy, y2y = 2 * yx * yy;
    const hx = 1 - (dx * y2x - dy * y2y), hy = -(dx * y2y + dy * y2x);
    wx[x] = zx + gx;
    wy[x] = zy + gy;
    d2[x] = (hx * hx + hy * hy) * S * S;
    mk[x] = 0;
  }
  // Keep the numbers small: SLE does not see the scale.
  if (s.scroll * PX - s.lnL > 9) renorm(s, 4);
}

function renorm(s, lnl) {
  const l = exp(lnl), il = 1 / l;
  s.lnL += lnl;
  for (let p = 0; p < N; p++) {
    s.wx[p] *= il;
    s.wy[p] *= il;
    s.d2[p] *= il * il;
  }
  s.Wd *= il;
  s.t *= il * il;
  for (let k = 0; k < s.n; k++) (s.hw[k] *= il), (s.ht[k] *= il * il);
  s.near *= il * il;
  let f = il;
  for (let n = 1; n <= M; n++) (f *= il), (s.b[n] *= f);
}

export function setup(params) {
  const F = (n) => new Float64Array(n);
  params.s = {
    wx: F(N), wy: F(N), d2: F(N), mk: new Uint8Array(N), mt: F(N),
    b: F(M + 1), Vc: F(M + 2), P: F(M + 2), Q: F(M + 2), hw: F(CAP), ht: F(CAP),
    seen: new Uint8Array(N), stack: new Int32Array(N), spare: null, acc: 0, hue: 0, kappa: 4, trace: 0.06,
    buf: new Float32Array(N * 3), tlut: new Float32Array(LUT * 3), blut: new Float32Array(LUT * 3),
    side: new Float32Array(12), lutHue: NaN,
  };
  fresh(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = k[0];
  s.kappa = cl(k[2], 4, 8);
  s.trace = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) fresh(s);
  const sp = cl(k[1], 0.2, 3);
  s.acc += d * sp * RATE;
  let n = floor(s.acc);
  s.acc -= n;
  s.tau += d * sp;
  while (n-- > 0) step(s, s.kappa);
  if (s.kappa > 4) fill(s);
  const [zx, zy] = tip(s);
  const [px, py] = toPanel(s, zx, zy);
  s.tipx = px;
  s.tipy = py;
  const rows = min(3, ceilPos(TIPROW - py));
  for (let i = 0; i < rows; i++) newRow(s);
  s.tipy = py + rows;
}
const ceilPos = (v) => (v > 0 ? Math.ceil(v) : 0);

// Colour stops, turned round the colour wheel by Hue: the trace by its age,
// new to old; swallowed ground by when it was swallowed; the field on the
// right and on the left of the curve; the rays and the rings of the grid.
const TRACE = [[255, 238, 196], [255, 178, 84], [250, 92, 112], [206, 62, 196], [124, 76, 236]];
const BUBBLE = [[150, 40, 92], [112, 34, 128], [58, 40, 128], [96, 30, 70], [150, 40, 92]];
const RIGHT = [16, 32, 78], LEFT = [8, 50, 72], RAY = [52, 150, 172], RING = [96, 112, 206];
const LUT = 64;
function ramp(stops, out, rot) {
  const n = stops.length - 1;
  for (let i = 0; i < LUT; i++) {
    const u = (i / (LUT - 1)) * n, j = min(n - 1, floor(u)), f = u - j;
    const c = [0, 1, 2].map((k) => stops[j][k] + (stops[j + 1][k] - stops[j][k]) * f);
    turn(c, rot, out, i * 3);
  }
}
// A hue turn that keeps the grey axis: rotation about (1, 1, 1).
function turn(c, a, out, o) {
  const co = cos(a), si = sin(a), k = (1 - co) / 3, r = sqrt(1 / 3) * si;
  const m0 = co + k, m1 = k - r, m2 = k + r;
  out[o] = cl(c[0] * m0 + c[1] * m1 + c[2] * m2, 0, 255);
  out[o + 1] = cl(c[0] * m2 + c[1] * m0 + c[2] * m1, 0, 255);
  out[o + 2] = cl(c[0] * m1 + c[1] * m2 + c[2] * m0, 0, 255);
}

// The grid is the conformal map log(g_t(z) - W_t), which unrolls what is
// left of the channel into a straight strip with the tip at minus infinity:
// its level lines are circles round the tip and the rays out of it. Where a
// cell grows large a finer grid fades in, up to three halvings.
const DELTA = PI / 8, LEVELS = 4, LOG7 = log(DELTA / 7);
export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const buf = s.buf, wx = s.wx, wy = s.wy, d2 = s.d2, mk = s.mk, mt = s.mt, Wk = s.Wd;
  const fld = 1 - s.trace, tr = s.tlut, bu = s.blut, side = s.side;
  if (s.lutHue !== s.hue) {
    const rot = s.hue * 2 * PI;
    ramp(TRACE, tr, rot);
    ramp(BUBBLE, bu, rot);
    turn(RIGHT, rot, side, 0);
    turn(LEFT, rot, side, 3);
    turn(RAY, rot, side, 6);
    turn(RING, rot, side, 9);
    s.lutHue = s.hue;
  }
  for (let py = 0, p = 0; py < H; py++)
    for (let x = 0; x < W; x++, p++) {
      const q = p * 3;
      if (mk[p]) {
        const age = max(0, s.tau - mt[p]);
        if (mk[p] === 1) {
          const i = min(LUT - 1, floor((age / 8) * (LUT - 1))) * 3;
          buf[q] = tr[i];
          buf[q + 1] = tr[i + 1];
          buf[q + 2] = tr[i + 2];
        } else {
          // Swallowed ground keeps the colour of the moment it was cut off,
          // and dims as it ages.
          const u = mt[p] / 5, i = floor((u - floor(u)) * (LUT - 1)) * 3, v = 0.55 + 0.45 * exp(-age / 6);
          const hat = ((x + (floor(u * 7) & 1 ? 1 : -1) * (py - s.scroll) + 4096) & 3) === 0 ? 1 : 0.5;
          buf[q] = bu[i] * v * hat;
          buf[q + 1] = bu[i + 1] * v * hat;
          buf[q + 2] = bu[i + 2] * v * hat;
        }
        continue;
      }
      const ux = wx[p] - Wk, uy = wy[p], r2 = ux * ux + uy * uy, rr = sqrt(r2);
      const lr = log(rr), th = atan2(uy, ux), lg = 0.5 * log(d2[p]);
      const cell = DELTA * exp(lr - lg); // LEDs per grid cell here
      const fa = lr / DELTA, fb = th / DELTA;
      // Lines, coarse to fine.
      let ring = 0, ray = 0, cj = cell, sa = fa, sb = fb, chk = 0;
      const lc = cl((lr - lg + LOG7) * 1.4427, 0, LEVELS - 1.001), jc = floor(lc), fc = lc - jc;
      for (let j = 0; j < LEVELS && (j <= jc + 1 || cj >= 6); j++) {
        const ia = floor(sa), ib = floor(sb), nb = round(sb);
        // The rays at angle 0 and pi are the boundary itself, not grid. The
        // ray at pi/2 is the hyperbolic geodesic from the tip to the top of
        // the channel, where the curve is bound, and burns brighter.
        const da = min(sa - ia, ia + 1 - sa) * cj, db = nb > 0 && nb < 8 << j ? abs(sb - nb) * cj : 99;
        const fade = j === 0 ? cl((cj - 2) / 3, 0, 1) : cl((cj - 6) / 6, 0, 1) * 0.6;
        ring = max(ring, cl(1 - da / 0.8, 0, 1) * fade);
        ray = max(ray, cl(1 - db / 0.8, 0, 1) * fade * (j === 0 && nb === 4 ? 1.6 : 1));
        if (j === jc) chk += ((ia + ib) & 1) * (1 - fc);
        if (j === jc + 1) chk += ((ia + ib) & 1) * fc;
        cj *= 0.5;
        sa *= 2;
        sb *= 2;
      }
      // The two sides of the curve: th / pi is the chance that a Brownian
      // walker from here leaves by the left-hand side.
      const hs = th / PI, cf = (0.82 + 0.36 * chk * cl((cell - 2) / 3, 0, 1)) * (0.4 + 0.6 * sqrt(uy / rr));
      let r = (side[0] + (side[3] - side[0]) * hs) * cf * fld;
      let gg = (side[1] + (side[4] - side[1]) * hs) * cf * fld;
      let bl = (side[2] + (side[5] - side[2]) * hs) * cf * fld;
      let li = ring * fld;
      r += (side[9] - r) * li;
      gg += (side[10] - gg) * li;
      bl += (side[11] - bl) * li;
      li = min(1, ray) * fld;
      const hot = max(0, ray - 1) * 1.6 * fld;
      r += (side[6] - r) * li;
      gg += (side[7] - gg) * li;
      bl += (side[8] - bl) * li;
      r += (210 - r) * hot;
      gg += (240 - gg) * hot;
      bl += (240 - bl) * hot;
      buf[q] = r;
      buf[q + 1] = gg;
      buf[q + 2] = bl;
    }
  // The tip.
  const tx = s.tipx, ty = s.tipy;
  for (let y = max(0, floor(ty - 3)); y <= min(H - 1, floor(ty + 3)); y++)
    for (let x = max(0, floor(tx - 3)); x <= min(W - 1, floor(tx + 3)); x++) {
      const dd = (x - tx) ** 2 + (y - ty) ** 2, w = exp(-dd / 1.5);
      const q = (y * W + x) * 3;
      buf[q] += (255 - buf[q]) * w;
      buf[q + 1] += (250 - buf[q + 1]) * w;
      buf[q + 2] += (235 - buf[q + 2]) * w;
    }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
