// ===== Patternflow pattern =====
// Title:   Greenhill Column
// Family:  physics
// Idea:    Eight elastic columns of different stiffness stand clamped along the bottom row and grow upward at a steady rate, each straight until it passes its own critical height, marked by a white tick, where it buckles under its own weight into the heavy elastica, solved every frame by shooting on the tip angle, and swings over until its tip points below the horizontal, when it shrinks back, straightens and grows again, so the stiffest one in the middle stands tallest.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: buckling of a heavy column under its own weight (Leonhard Euler, 1778; Alfred George Greenhill, 1881), Euler's flagpole with a weight on top (Leonhard Euler, 1744), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Spread=3..64, Top weight=0..40
//
// Knob 1: Hue. At 0 the columns run from azure for the softest through blue and violet to rose for the stiffest, dim while straight and bright where they bend hardest; the knob turns them all round the wheel together, skipping orange, yellow and lime, which read brown and olive when dim.
// Knob 2: Speed. At 2 the columns grow 8 LEDs a second and shrink back at 16. The stiffest takes 1 to 3 s to grow from where it last shrank back to its tick, 2 s more to fall over and about 2 s to shrink and straighten. At 0.2 they grow 0.8 LEDs a second, at 3 12.
// Knob 3: Spread. The stiffest column's EI over the softest's, 3 to 64, in equal ratios between. Greenhill's height goes as the cube root of EI, so at 3 the eight columns buckle at 83 to 120 LEDs, at 16 at 48 to 120 and at 64 at 30 to 120.
// Knob 4: Top weight. A weight P on every tip, 0 to 40 LEDs' worth of column. Near 0 it is Greenhill's column, buckling at 83 to 120 LEDs at Spread 3; at 20 they buckle at 67 to 103, at 40 at 56 to 90. Euler's flagpole, the top weight alone, buckles where P = pi^2 EI / (4 L^2), 67 to 117 LEDs at 40, and the softer a column the closer it comes: at Spread 64 and 40 the softest buckles at 14 LEDs against the flagpole's 15.

const W = 64, H = 128, NC = 8, NS = 24;
const { floor, min, max, abs, sqrt, sin, cos, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Lengths in LEDs, weight per LED of column Q = 1. Greenhill's column
// buckles once q L^3 / EI passes 7.837, where (2/3) sqrt(q L^3 / EI) reaches
// 1.866, the first zero of the Bessel function J_-1/3 in his solution;
// Euler had tried the same problem in 1778. The stiffest column has EI =
// 120^3 / 7.837, so with no top weight it buckles at 120 LEDs, and the
// others step down in EI by equal ratios to 1 / Spread of it.
const Q = 1, LTOP = 120, GREENHILL = 7.837;
// The tip angle at which a column gives up and shrinks back: 100 degrees,
// reached at 1.14 times the critical height with no top weight.
const DROOP = (100 * PI) / 180;
// Where each column stands, left to right: its rank in stiffness, 0 the
// softest, so the stiffest stand in the middle.
const RANK = [0, 2, 4, 6, 7, 5, 3, 1];
const BASEY = H - 0.5;
// The pen: a core 2.6 LEDs wide at full strength and a glow out to 4.5,
// tabulated by squared distance.
const R2 = 4.5 * 4.5, PEN_STEP = 12, PEN = new Float32Array(Math.ceil(R2 * PEN_STEP) + 1);
for (let i = 0; i < PEN.length; i++) {
  const dd = sqrt(i / PEN_STEP);
  PEN[i] = dd <= 1.3 ? 1 : 0.7 * exp(-((dd - 1.3) * (dd - 1.3)) / 4.5);
}

// The heavy elastica: EI theta''(s) = -(q (L - s) + P) sin theta, with s
// measured up the column. Scaled to s in [0, 1] it is theta'' = -(lam (1 -
// s) + mu) sin theta, lam = q L^3 / EI and mu = P L^2 / EI. This integrates
// it by RK4 in NS steps from the free top, where theta = alpha and theta' = 0
// (no moment), down to the clamp, and returns theta there, which must be 0.
// If th is given it gets theta and theta' at the points s = i / NS.
function shoot(alpha, lam, mu, th, dth) {
  let t = alpha, w = 0, s = 1;
  const h = -1 / NS;
  if (th) {
    th[NS] = t;
    dth[NS] = 0;
  }
  for (let i = NS - 1; i >= 0; i--) {
    const a1 = -(lam * (1 - s) + mu), a2 = -(lam * (1 - s - h / 2) + mu), a3 = -(lam * (1 - s - h) + mu);
    const k1t = w, k1w = a1 * sin(t);
    const k2t = w + (h / 2) * k1w, k2w = a2 * sin(t + (h / 2) * k1t);
    const k3t = w + (h / 2) * k2w, k3w = a2 * sin(t + (h / 2) * k2t);
    const k4t = w + h * k3w, k4w = a3 * sin(t + h * k3t);
    t += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    s += h;
    if (th) {
      th[i] = t;
      dth[i] = w;
    }
  }
  return t;
}

// The linear problem u'' = -(lam (1 - s) + mu) u with u(1) = 1, u'(1) = 0:
// the column is critical where u(0) first reaches 0.
function linear(lam, mu) {
  let u = 1, w = 0, s = 1;
  const h = -1 / NS;
  for (let i = 0; i < NS; i++) {
    const a1 = -(lam * (1 - s) + mu), a2 = -(lam * (1 - s - h / 2) + mu), a3 = -(lam * (1 - s - h) + mu);
    const k1u = w, k1w = a1 * u;
    const k2u = w + (h / 2) * k1w, k2w = a2 * (u + (h / 2) * k1u);
    const k3u = w + (h / 2) * k2w, k3w = a2 * (u + (h / 2) * k2u);
    const k4u = w + h * k3w, k4w = a3 * (u + h * k3u);
    u += (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    s += h;
  }
  return u;
}

// The critical height of a column of stiffness EI under top weight P, by
// bisection on L between 0 and its Greenhill height.
function critical(EI, P) {
  let lo = 0, hi = Math.cbrt((GREENHILL * EI) / Q) * 1.0001;
  for (let it = 0; it < 28; it++) {
    const L = (lo + hi) / 2;
    if (linear((Q * L * L * L) / EI, (P * L * L) / EI) > 0) lo = L;
    else hi = L;
  }
  return (lo + hi) / 2;
}

// The tip angle of the buckled column, by bisection, starting from a
// bracket round the last answer and falling back to a scan down from pi.
// The bifurcation is supercritical, so the answer grows from 0 at the
// critical height: 41 degrees at 1.02 times it, 88 at 1.10.
function tipAngle(lam, mu, prev, ratio) {
  let lo = -1, hi = -1;
  if (prev > 0.02) {
    const a = max(1e-4, prev - 0.12), b = min(PI - 1e-4, prev + 0.12);
    if (shoot(a, lam, mu) < 0 && shoot(b, lam, mu) > 0) {
      lo = a;
      hi = b;
    }
  }
  if (lo < 0) {
    if (shoot(1e-4, lam, mu) > 0 && ratio < 1.5) return 0;
    for (let k = 47; k >= 1; k--) {
      const a = (k * PI) / 48;
      if (shoot(a, lam, mu) < 0) {
        lo = a;
        hi = ((k + 1) * PI) / 48 - 1e-4;
        break;
      }
    }
    if (lo < 0) return 0;
  }
  for (let it = 0; it < 20; it++) {
    const m = (lo + hi) / 2;
    if (shoot(m, lam, mu) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// Hue h in turns, with orange, yellow and lime (0.03 to 0.25) skipped,
// since they read brown and olive when dim.
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 0.78;
  if (h >= 0.03) h += 0.22;
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

export function setup(params) {
  const cols = [];
  for (let k = 0; k < NC; k++)
    cols.push({ x: 3.5 + 8 * k, rank: RANK[k], EI: 1, Lc: 60, L: 0, grow: 1, side: 1, back: 0.8, alpha: 0, th: new Float64Array(NS + 1), dth: new Float64Array(NS + 1) });
  params.s = { cols, spread: -1, P: -1, hue: 0, started: false, rgb: new Float32Array(W * H * 3), cb: new Float32Array(W * H), touched: new Int32Array(W * H), c: [0, 0, 0] };
  return params.s;
}

function pickSide(c) {
  c.side = Math.random() < 0.5 ? -1 : 1;
  c.back = 0.8 + 0.12 * Math.random();
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 3, 0], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1], 0.2, 3), spread = cl(kv[2], 3, 64), P = cl(kv[3], 0, 40);
  if (spread !== S.spread || P !== S.P) {
    S.spread = spread;
    S.P = P;
    for (const c of S.cols) {
      c.EI = ((Q * LTOP ** 3) / GREENHILL) * spread ** (-(NC - 1 - c.rank) / (NC - 1));
      c.Lc = critical(c.EI, P);
    }
  }
  if (!S.started) {
    // Pre-roll: every column starts somewhere in its cycle, from its
    // shrink-back height to 1.11 times its critical height, 80% of them
    // growing.
    S.started = true;
    for (const c of S.cols) {
      pickSide(c);
      c.L = c.Lc * (c.back + (1.11 - c.back) * Math.random());
      c.grow = Math.random() < 0.8 ? 1 : -1;
    }
  }
  const rate = 4 * speed * d;
  for (const c of S.cols) {
    // Shrinking runs at twice the growth rate, and faster when a knob has
    // left a column more than 1.2 times its new critical height.
    c.L = max(4, c.grow > 0 ? c.L + rate : c.L - max(2 * rate, 3 * d * (c.L - 1.2 * c.Lc)));
    const lam = (Q * c.L * c.L * c.L) / c.EI, mu = (S.P * c.L * c.L) / c.EI;
    c.alpha = c.L > c.Lc ? tipAngle(lam, mu, c.alpha, c.L / c.Lc) : 0;
    if (c.grow > 0 && c.alpha > DROOP) c.grow = -1;
    else if (c.grow < 0 && c.L < c.back * c.Lc) {
      c.grow = 1;
      pickSide(c);
    }
    if (c.alpha > 0) shoot(c.alpha, lam, mu, c.th, c.dth);
    else {
      c.th.fill(0);
      c.dth.fill(0);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, cb = S.cb, touched = S.touched, col = S.c;
  rgb.fill(0);
  for (const c of S.cols) {
    let nt = 0;
    const seg = c.L / NS;
    let x = c.x, y = BASEY;
    for (let i = 0; i < NS; i++) {
      const t0 = c.th[i], t1 = c.th[i + 1], tm = (t0 + t1) / 2;
      const nx = x + c.side * sin(tm) * seg, ny = y - cos(tm) * seg;
      const steps = max(1, Math.ceil(seg));
      for (let k = 0; k < steps; k++) {
        const f = (k + 0.5) / steps, px = x + (nx - x) * f, py = y + (ny - y) * f;
        // Bending stress: the curvature times the length, 0 on a straight
        // column and about 4 at the clamp when the tip is horizontal.
        const kap = abs(c.dth[i] + (c.dth[i + 1] - c.dth[i]) * f);
        const b = 0.42 + 0.58 * min(1, kap / 4);
        const x0 = max(0, floor(px - 4.5)), x1 = min(W - 1, Math.ceil(px + 4.5));
        const y0 = max(0, floor(py - 4.5)), y1 = min(H - 1, Math.ceil(py + 4.5));
        for (let Y = y0; Y <= y1; Y++) {
          const dy = Y + 0.5 - py;
          for (let X = x0; X <= x1; X++) {
            const dx = X + 0.5 - px, d2 = dx * dx + dy * dy;
            if (d2 >= R2) continue;
            const v = b * PEN[(d2 * PEN_STEP) | 0], p = Y * W + X;
            if (cb[p] === 0) touched[nt++] = p;
            if (v > cb[p]) cb[p] = v;
          }
        }
      }
      x = nx;
      y = ny;
    }
    hsv(0.48 + S.hue + 0.065 * c.rank, 0.78, 1, col);
    for (let k = 0; k < nt; k++) {
      const p = touched[k], v = cb[p], o = p * 3;
      // Hot spots of stress go toward white.
      const wv = max(0, v - 0.75) * 1.6;
      const r = v * col[0] + wv, g = v * col[1] + wv, bl = v * col[2] + wv;
      if (r > rgb[o]) rgb[o] = r;
      if (g > rgb[o + 1]) rgb[o + 1] = g;
      if (bl > rgb[o + 2]) rgb[o + 2] = bl;
      cb[p] = 0;
    }
  }
  // The ticks: a white bar 7 LEDs wide at each column's critical height,
  // dimmer over the three LEDs where a straight column passes through it.
  for (const c of S.cols) {
    const ty = floor(BASEY - c.Lc);
    if (ty < 0 || ty >= H) continue;
    const cx = floor(c.x);
    for (let X = cx - 3; X <= cx + 3; X++) {
      if (X < 0 || X >= W) continue;
      const o = (ty * W + X) * 3, v = abs(X - cx) <= 1 ? 0.55 : 0.85;
      rgb[o] = max(rgb[o], v);
      rgb[o + 1] = max(rgb[o + 1], v);
      rgb[o + 2] = max(rgb[o + 2], v);
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
}
