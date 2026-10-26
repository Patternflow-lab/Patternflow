// ===== Patternflow pattern =====
// Title:   Euler's Elastica
// Family:  physics
// Idea:    A thin elastic rod 120 LEDs long, pinned at both ends on its line of thrust, is slowly pushed and let go and sweeps Euler's family of bent shapes from the first slight bow through the arch and the drop where its ends meet to the loops where they pass each other, while a bead runs along it, a pendulum above swings with its arm always parallel to the rod at the bead, and the pendulum's orbit goes round its phase portrait below.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Euler's elastica (Leonhard Euler, 1744), after Jacob Bernoulli's elastic curve (1694), with Kirchhoff's kinetic analogy to the pendulum (Gustav Kirchhoff, 1859), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Mode=1..4, Preload=0..1
//
// Knob 1: Hue. The rod is coloured by the direction it points, and the same colours mark the pendulum's swing and the orbit below. At 0 a straight rod is cyan, leaning one way it turns green and the other way violet; the knob turns all of it round the wheel, hurrying past orange and yellow.
// Knob 2: Speed. At 2 one push and release takes 16 seconds and the bead runs the rod in 2.4; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Mode. How many half waves the rod buckles into, 1 to 4. At the same end slope mode n carries n squared times the load of mode 1, and its rod is n copies of the mode 1 shape at 1/n the size, each the mirror of the one before.
// Knob 4: Preload. How far each release goes back. At 0 the rod comes back straight and buckles again to a side picked by chance; at 0.5 it never unbends past an end slope of 38 degrees, and at 1 it stays among the loops, 150 to 176 degrees.
// Buttons: K1 tap holds the load where it is, so one shape stands still while the bead and the pendulum keep going; a second tap lets the load move again.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, abs, sqrt, sin, cos, asin, exp, PI } = Math;
const DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The rod is 120 LEDs long and drawn from 241 points half an LED apart.
const L = 120, M = 240;
// The largest end slope, one push and release at Speed 2 in seconds, and the
// bead's speed at Speed 2 in LEDs a second.
const AMAX = 176 * DEG, CYCLE = 16, BEAD = 50;
// The rod's radius in each mode: thinner for the smaller loops of modes 3 and 4.
const RAD = [0, 2.7, 2.6, 2.2, 1.9];
// The pendulum's pivot and arm, and the phase portrait's middle row, half
// height and half width.
const PX = 31.5, PY = 20.5, PL = 16.5;
const PIN = [0.82, 0.82, 0.86];
const QY = 108.5, QH = 16, QW = 29.5;
// Light from the upper left and in front, and the half vector for the shine.
const LX = -0.42, LY = -0.5, LZ = 0.757;
const HX = -0.229, HY = -0.272, HZ = 0.935;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The arithmetic-geometric mean of 1 and k' gives K(k), E(k) and the a_n, c_n
// the Jacobi functions are built from (Abramowitz and Stegun 17.6).
function agm(k, g) {
  const a = g.a, c = g.c;
  let b = sqrt(1 - k * k), n = 0, sum = 0.5 * k * k;
  a[0] = 1;
  c[0] = k;
  while (n < 15 && c[n] > 1e-15) {
    const an = a[n];
    a[n + 1] = (an + b) / 2;
    c[n + 1] = (an - b) / 2;
    b = sqrt(an * b);
    n++;
    sum += 2 ** (n - 1) * c[n] * c[n];
  }
  g.n = n;
  g.K = PI / (2 * a[n]);
  g.E = g.K * (1 - sum);
}

// sn u, cn u and Jacobi's epsilon E(u) = Z(u) + u E/K, by the descending
// Landen sequence of amplitudes; Z(u) is the sum of c_n sin(phi_n).
function jac(u, g, o) {
  const { a, c, n, ph } = g;
  ph[n] = 2 ** n * a[n] * u;
  let z = 0;
  for (let i = n; i >= 1; i--) {
    z += c[i] * sin(ph[i]);
    ph[i - 1] = (asin((c[i] / a[i]) * sin(ph[i])) + ph[i]) / 2;
  }
  o.sn = sin(ph[0]);
  o.cn = cos(ph[0]);
  o.e = z + (g.E / g.K) * u;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    hue: 0, mode: 1, alo: 0, al: 0, ph: 0.07, side: 1, hold: false,
    sb: 0, dir: 1,
    g: { a: new Float64Array(17), c: new Float64Array(17), ph: new Float64Array(17), n: 0, K: PI / 2, E: PI / 2 },
    j: { sn: 0, cn: 1, e: 0 },
    cx: F(M + 1), cy: F(M + 1), sg: F(M + 1),
    buf: F(N * 3), zs: F(N), zd: F(N), zo: F(N), col: F(3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  const btn = input.btnPressed || [];
  S.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3);
  S.mode = cl(round(k[2]), 1, 4);
  const pre = cl(k[3], 0, 1);
  S.alo = 150 * DEG * pre * pre;
  if (btn[0]) S.hold = !S.hold;
  if (!S.hold) {
    const was = floor(S.ph);
    S.ph += (d * sp) / (2 * CYCLE);
    // Back at the bottom of a release with the rod straight, it buckles again
    // to whichever side chance picks.
    if (floor(S.ph) !== was && S.alo < 1.2 * DEG) S.side = Math.random() < 0.5 ? -1 : 1;
  }
  S.al = S.alo + (AMAX - S.alo) * (0.5 - 0.5 * cos(2 * PI * S.ph));
  S.sb += d * sp * (BEAD / 2) * S.dir;
  if (S.sb > L) (S.sb = 2 * L - S.sb), (S.dir = -1);
  if (S.sb < 0) (S.sb = -S.sb), (S.dir = 1);
}

// The colour of a rod pointing at screen angle a from straight up. The wheel
// hurries from rose to lime, so dim orange and yellow, brown and olive on
// this panel, hardly come up.
function tint(S, a, out, o) {
  let h = S.hue + 0.53 + (0.24 * a) / PI;
  h -= floor(h);
  const x = (h + 0.05 - floor(h + 0.05)) / 0.3;
  if (x < 1) h = 0.95 + 0.3 * (x - sin(2 * PI * x) / (2 * PI));
  hsv(h, 0.8, 1, out, o);
}

// A point drawn between four LEDs, each channel kept at the brightest.
function dot(buf, x, y, r, g, b) {
  x -= 0.5;
  y -= 0.5;
  const x0 = floor(x), y0 = floor(y), fx = x - x0, fy = y - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const X = x0 + i, Y = y0 + j;
      if (X < 0 || X >= W || Y < 0 || Y >= H) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), p = (Y * W + X) * 3;
      buf[p] = max(buf[p], r * w);
      buf[p + 1] = max(buf[p + 1], g * w);
      buf[p + 2] = max(buf[p + 2], b * w);
    }
}

function line(buf, ax, ay, bx, by, r, g, b) {
  const m = max(1, ceil(Math.hypot(bx - ax, by - ay) * 2));
  for (let i = 0; i <= m; i++) dot(buf, ax + ((bx - ax) * i) / m, ay + ((by - ay) * i) / m, r, g, b);
}

// A shaded ball, written over what is there.
function ball(buf, x, y, R, col) {
  for (let Y = max(0, floor(y - R - 1)); Y <= min(H - 1, ceil(y + R + 1)); Y++)
    for (let X = max(0, floor(x - R - 1)); X <= min(W - 1, ceil(x + R + 1)); X++) {
      const dx = X + 0.5 - x, dy = Y + 0.5 - y, d2 = dx * dx + dy * dy, p = (Y * W + X) * 3;
      if (d2 >= (R + 0.9) * (R + 0.9)) continue;
      if (d2 >= R * R) {
        buf[p] = buf[p + 1] = buf[p + 2] = 0;
        continue;
      }
      const nz = sqrt(R * R - d2) / R, nx = dx / R, ny = dy / R;
      const lam = max(0, nx * LX + ny * LY + nz * LZ), sh = max(0, nx * HX + ny * HY + nz * HZ) ** 24;
      const v = 0.3 + 0.75 * lam;
      buf[p] = col[0] * v + sh * 0.6;
      buf[p + 1] = col[1] * v + sh * 0.6;
      buf[p + 2] = col[2] * v + sh * 0.6;
    }
}

// The rod's shape for end slope al in mode n, in closed form. With
// k = sin(al/2) and sqrt(lambda) = 2nK/L, the tangent's angle theta from the
// line of thrust has sin(theta/2) = k sn(u), u = sqrt(lambda) s + K, so
// theta'' = -lambda sin(theta), the pendulum. Integrating cos and sin of theta:
// x = (2/sqrt(lambda)) (E(u) - E(K)) - s along the line, y = -(2k/sqrt(lambda)) cn(u) off it.
function shape(S) {
  const { g, j, cx, cy, sg } = S, k = sin(S.al / 2), n = S.mode;
  agm(k, g);
  const r = (2 * n * g.K) / L;
  jac(g.K, g, j);
  const e0 = j.e;
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i <= M; i++) {
    const s = (L * i) / M;
    jac(r * s + g.K, g, j);
    cy[i] = (2 / r) * (j.e - e0) - s;
    cx[i] = S.side * (-2 * k / r) * j.cn;
    sg[i] = S.side * 2 * asin(cl(k * j.sn, -1, 1));
    lo = min(lo, cx[i]);
    hi = max(hi, cx[i]);
  }
  // The pins sit on the vertical centre line while the rod fits the panel.
  // Mode 1 bows to one side only, up to 48.4 LEDs at an end slope of 114
  // degrees, so there the line of thrust slides over with the pins on it
  // until the bow clears the far edge. Nothing is scaled.
  const m = RAD[n] + 1.6, D = cy[M], ox = cl(31.5, m - lo, W - m - hi);
  for (let i = 0; i <= M; i++) {
    cx[i] += ox;
    cy[i] = 63.5 + D / 2 - cy[i];
  }
  S.r = r;
  S.k = k;
  S.ox = ox;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  shape(S);
  const { buf, zs, zd, zo, cx, cy, sg, g, j, col } = S, k = S.k;
  buf.fill(0);
  zs.fill(-1);

  // The bead's angle and the pendulum's phase: going up the rod is forward
  // time, coming back down is the same swing run on.
  jac(S.r * S.sb + g.K, g, j);
  const sb = S.side * 2 * asin(cl(k * j.sn, -1, 1));
  const vb = S.side * k * j.cn * S.dir;
  const ub = S.dir > 0 ? S.r * S.sb + g.K : 2 * g.K - (S.r * S.sb + g.K);

  // The line of thrust between the pins, dotted.
  const ya = cy[0], yb = cy[M];
  for (let y = min(ya, yb) + 1; y < max(ya, yb) - 1; y += 2) dot(buf, S.ox, y, 0.28, 0.28, 0.34);

  // The pendulum, all of it behind the rod. Its arm hangs straight down when
  // the rod at the bead points straight up. First a long exposure of the
  // swing: the arm lingers where it turns, so the fan is brightest at its
  // edges, by how slowly the pendulum passes each angle.
  const pend = (a) => [PX - PL * sin(a), PY + PL * cos(a)];
  for (let y = max(0, floor(PY - PL - 1)); y <= ceil(PY + PL + 1); y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - PX, dy = y + 0.5 - PY, rr = Math.hypot(dx, dy);
      if (rr > PL + 0.5 || rr < 1.5) continue;
      const a = Math.atan2(-dx, dy), sa = sin(abs(a) / 2);
      if (sa >= k) continue;
      const v = sqrt(1 - (sa * sa) / (k * k)), f = (round((0.07 + 0.2 * (1 - v) ** 2) * 16) / 16) * min(1, PL + 0.5 - rr);
      tint(S, a, col, 0);
      const o = (y * W + x) * 3;
      buf[o] = col[0] * f;
      buf[o + 1] = col[1] * f;
      buf[o + 2] = col[2] * f;
    }
  // The bob's path from -al to al in the rod's colours, and the arm where it
  // was over the bead's last 12 LEDs, fading.
  for (let a = -S.al; a <= S.al; a += 0.5 / PL) {
    tint(S, a, col, 0);
    const [x, y] = pend(a);
    dot(buf, x, y, col[0] * 0.4, col[1] * 0.4, col[2] * 0.4);
  }
  for (let q = 12; q >= 1; q--) {
    let s = S.sb - S.dir * q;
    s = s < 0 ? -s : s > L ? 2 * L - s : s;
    jac(S.r * s + g.K, g, j);
    const a = S.side * 2 * asin(cl(k * j.sn, -1, 1)), f = 0.34 * (1 - q / 13);
    tint(S, a, col, 0);
    const [x, y] = pend(a);
    line(buf, PX, PY, x, y, col[0] * f, col[1] * f, col[2] * f);
  }
  const [bx, by] = pend(sb);
  line(buf, PX, PY, bx, by, 0.62, 0.62, 0.68);
  tint(S, sb, col, 0);
  ball(buf, bx, by, 3.3, col);
  ball(buf, PX, PY, 1.3, PIN);

  // The phase portrait: the separatrix and the orbits of end slopes 30 to 150
  // degrees, faint, and the orbit at this slope, brightest just behind the
  // moving point. An orbit of slope b has sin(theta/2) = sin(b/2) sin(t) and
  // theta' over twice sqrt(lambda) = sin(b/2) cos(t).
  const qx = (a) => 31.5 - (QW * a) / PI, qy = (v) => QY - QH * v;
  for (let a = -PI; a <= PI; a += 0.02) {
    const v = cos(a / 2);
    tint(S, a, col, 0);
    dot(buf, qx(a), qy(v), col[0] * 0.26, col[1] * 0.26, col[2] * 0.26);
    dot(buf, qx(a), qy(-v), col[0] * 0.26, col[1] * 0.26, col[2] * 0.26);
  }
  for (let o = 1; o <= 5; o++) {
    const kb = sin((o * PI) / 12);
    for (let t = 0; t < 2 * PI; t += 0.03) {
      const a = 2 * asin(kb * sin(t));
      tint(S, a, col, 0);
      dot(buf, qx(a), qy(kb * cos(t)), col[0] * 0.16, col[1] * 0.16, col[2] * 0.16);
    }
  }
  const K4 = 4 * g.K, steps = 520;
  for (let i = 0; i < steps; i++) {
    const u = (K4 * i) / steps;
    jac(u, g, j);
    const a = S.side * 2 * asin(cl(k * j.sn, -1, 1)), v = S.side * k * j.cn;
    let b = (ub - u) / K4;
    b -= floor(b);
    const f = 0.42 + 0.58 * exp(-b * 7);
    tint(S, a, col, 0);
    dot(buf, qx(a), qy(v), col[0] * f, col[1] * f, col[2] * f);
  }
  tint(S, sb, col, 0);
  ball(buf, qx(sb), qy(vb), 1.9, col);

  // The rod. Each LED near it takes the nearest point of the strand on top:
  // a strand more than one and a half rod widths further along lies over the
  // earlier one, and its dark rim cuts the one below where the loops cross.
  const R = RAD[S.mode], R1 = R + 1.1, same = 6 * R;
  for (let i = 0; i < M; i++) {
    const ax = cx[i], ay = cy[i], dx = cx[i + 1] - ax, dy = cy[i + 1] - ay, l2 = dx * dx + dy * dy || 1e-9, ln = sqrt(l2);
    const x0 = max(0, floor(min(ax, ax + dx) - R1)), x1 = min(W - 1, ceil(max(ax, ax + dx) + R1));
    const y0 = max(0, floor(min(ay, ay + dy) - R1)), y1 = min(H - 1, ceil(max(ay, ay + dy) + R1));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5 - ax, py = y + 0.5 - ay, t = cl((px * dx + py * dy) / l2, 0, 1);
        const qx2 = px - t * dx, qy2 = py - t * dy, d2 = qx2 * qx2 + qy2 * qy2;
        if (d2 >= R1 * R1) continue;
        const p = y * W + x, s = i + t, z = zs[p], dd = sqrt(d2);
        if (z >= 0 && s <= z + same && dd >= zd[p]) continue;
        zs[p] = s;
        zd[p] = dd;
        zo[p] = (dx * qy2 - dy * qx2) / ln;
      }
  }
  for (let p = 0; p < N; p++) {
    const s = zs[p];
    if (s < 0) continue;
    const o = p * 3;
    if (zd[p] >= R) {
      buf[o] = buf[o + 1] = buf[o + 2] = 0;
      continue;
    }
    const i = min(M - 1, floor(s)), f = s - i, a = sg[i] + (sg[i + 1] - sg[i]) * f;
    // The tube's normal: across the rod in the panel, and out of it.
    const u = zo[p] / R, w = sqrt(max(0, 1 - u * u)), nx = cos(a) * u, ny = sin(a) * u;
    const lam = max(0, nx * LX + ny * LY + w * LZ), sh = max(0, nx * HX + ny * HY + w * HZ) ** 20;
    tint(S, a, col, 0);
    const sl = (s * L) / M, gb = exp(-(((sl - S.sb) / 1.7) ** 2)), tr = S.dir * (S.sb - sl);
    const v = (0.3 + 0.75 * lam) * (1 + (tr > 0 ? 0.35 * exp(-tr / 9) : 0));
    buf[o] = col[0] * v + sh * 0.55 + gb * 0.8;
    buf[o + 1] = col[1] * v + sh * 0.55 + gb * 0.8;
    buf[o + 2] = col[2] * v + sh * 0.55 + gb * 0.8;
  }

  // The pins, on top.
  ball(buf, cx[0], cy[0], 2.2, PIN);
  ball(buf, cx[M], cy[M], 2.2, PIN);

  for (let p = 0, o = 0; p < N; p++, o += 3) {
    if (buf[o] + buf[o + 1] + buf[o + 2] < 0.02) continue;
    // Each channel in steps of 4 of 255.
    display.setPixel(p % W, (p / W) | 0, min(255, round(buf[o] * 63.75) * 4), min(255, round(buf[o + 1] * 63.75) * 4), min(255, round(buf[o + 2] * 63.75) * 4));
  }
}
