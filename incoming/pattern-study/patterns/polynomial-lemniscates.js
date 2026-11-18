// ===== Patternflow pattern =====
// Title:   Polynomial Lemniscates
// Family:  line
// Idea:    The complex plane stands up the tall panel with n roots drifting on a breathing ellipse, every log|p| level drawn as a sharp rainbow loop, and one gold lemniscate |p| = c that sweeps up and down through the critical values, so the blob round the roots pinches into more ovals, one cross at a time, exactly when c falls below that cross's critical value, and each cross flashes as c passes.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: lemniscate of a polynomial |p(z)| = c, for two roots Cassini's oval (Giovanni Domenico Cassini, 1680) and at c = |a1 - a2|^2 / 4 Bernoulli's lemniscate (Jacob Bernoulli, 1694), the shapes of these sets asked about by Erdos, Herzog and Piranian (1958), pattern round 106
// Round:   106
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0.2..3, Roots=2..8, Drift=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the level loops are blue far from the roots, cyan and green in the middle and violet close to a root, the tint inside the gold loop is purple, the crosses are gold-white once c is above their value and pale blue while it is below, and the gold lemniscate itself is always gold with a white-hot core.
// Knob 2: Sweep. How fast c sweeps and the roots drift. At 2 c goes from below the smallest critical value to above the largest and back in 22 s, and the first rise passes the middle of its range at 6.5 s, so with two roots the pinch is at 6.5 s. The ellipse breathes in width once in 20 s. 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Roots. The degree n of the monic polynomial p(z) = (z - a1)...(z - an), a whole number from 2 to 8, spread round a tall ellipse. There are n - 1 critical points: with two roots the one cross is the middle of Cassini's ovals, with eight there are seven, and the gold set is n separate ovals while c is below all their values and one blob once it is above them all.
// Knob 4: Drift. How far each root wanders from its place on the ellipse, from 0.02 of a unit (under one LED) at 0 to 0.34 (eleven LEDs across, sixteen up and down) at 1. At 0 the roots only breathe with the ellipse; at 1 the critical values slide through each other and the pinches come in any order.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, exp, log, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The window is x in -1..1 and y in -2..2 with y up, 32 LEDs to the unit. The
// sweep runs c from below the smallest critical value to above the largest,
// with MARGIN of log c to spare at each end, in T_SWEEP seconds there and back
// at Sweep 2.
const PX = 32, MARGIN = 0.9, T_SWEEP = 22;
// The sweep starts a little before the bottom, so that for two roots the middle
// of the sweep, where c passes their one critical value, comes at 6.5 s.
const START = Math.PI / 2 - (TAU * 6.5) / T_SWEEP;
const RMIN = 2, RMAX = 8;
// The hue of a level loop runs up and back over this many levels.
const PERIOD = 36;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The roots are spread by arc length round the ellipse, not by angle, or the
// ones at the top and bottom, where it bends, would crowd. ARC[i] is the angle
// at which the ellipse's arc length from the right-hand end is i / 256 of the
// whole.
const ARC = (() => {
  const M = 4096, cum = new Float64Array(M + 1);
  for (let i = 1; i <= M; i++) {
    const t = ((i - 0.5) / M) * TAU;
    cum[i] = cum[i - 1] + sqrt((0.64 * sin(t)) ** 2 + (1.36 * cos(t)) ** 2);
  }
  const out = new Float64Array(257);
  let j = 0;
  for (let i = 0; i <= 256; i++) {
    const target = (cum[M] * i) / 256;
    while (j < M - 1 && cum[j + 1] < target) j++;
    out[i] = ((j + (target - cum[j]) / (cum[j + 1] - cum[j])) / M) * TAU;
  }
  return out;
})();
const thOf = (s) => {
  s -= floor(s);
  const f = s * 256, i = floor(f);
  return ARC[i] + (ARC[i + 1] - ARC[i]) * (f - i);
};

export function setup(params) {
  let seed = 7;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 4294967296);
  const X = new Float32Array(W), Y = new Float32Array(H);
  for (let i = 0; i < W; i++) X[i] = (i + 0.5 - 32) / PX;
  for (let i = 0; i < H; i++) Y[i] = (64 - i - 0.5) / PX;
  params.s = {
    X, Y,
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
    jit: Array.from({ length: RMAX }, () => rnd() * 2 - 1),
    rad: Array.from({ length: RMAX }, () => rnd()),
    n: 0, hue: 0, speed: 2, drift: 0, u: 0, phase: START,
    ax: new Float64Array(RMAX), ay: new Float64Array(RMAX),
    pr: new Float64Array(RMAX + 1), pi: new Float64Array(RMAX + 1),
    // critical points, their log critical values, which side of c each is on
    // and its flash
    cr: new Float64Array(RMAX), ci: new Float64Array(RMAX), cv: new Float64Array(RMAX),
    sg: new Int8Array(RMAX), fl: new Float32Array(RMAX), fd: new Int8Array(RMAX), have: false,
    lo: 0, hi: 0, Lc: 0, pal: new Float32Array(PERIOD * 3), palHue: -1,
  };
}

// The roots stand on a tall ellipse, spread round it with a fixed jitter, and
// each one breathes with the ellipse and wanders by A on paths of its own.
function place(S) {
  const n = S.n, u = S.u, A = 0.02 + 0.32 * S.drift;
  const rx = 0.64 * (1 + 0.07 * sin(0.31 * u)), ry = 1.36 * (1 + 0.05 * sin(0.23 * u + 1));
  const js = (n <= 3 ? 0.1 : 0.3) / n;
  for (let k = 0; k < n; k++) {
    const th = thOf((k + 0.5) / n + js * S.jit[k] + 0.016 * sin(0.17 * u + 1.7 * k));
    const rf = 0.82 + 0.28 * S.rad[k];
    S.ax[k] = rx * rf * cos(th) + A * sin(0.37 * u + 2.3 * k + 0.5);
    S.ay[k] = ry * rf * sin(th) + 1.5 * A * sin(0.29 * u + 1.9 * k);
  }
}

// The critical points are the roots of p', found by Durand and Kerner's
// iteration on its coefficients, started from where they were a frame ago.
function critical(S) {
  const n = S.n, m = n - 1, pr = S.pr, pi = S.pi, ax = S.ax, ay = S.ay;
  pr.fill(0);
  pi.fill(0);
  pr[0] = 1;
  for (let k = 0; k < n; k++) {
    const ar = ax[k], ai = ay[k];
    for (let i = k + 1; i >= 0; i--) {
      const r = pr[i], q = pi[i];
      pr[i] = (i > 0 ? pr[i - 1] : 0) - (ar * r - ai * q);
      pi[i] = (i > 0 ? pi[i - 1] : 0) - (ar * q + ai * r);
    }
  }
  // q = p' / n, monic of degree m: coefficient i is (i + 1) p[i + 1] / n.
  const qr = new Float64Array(m), qi = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    qr[i] = ((i + 1) * pr[i + 1]) / n;
    qi[i] = ((i + 1) * pi[i + 1]) / n;
  }
  const zr = S.cr, zi = S.ci;
  const run = (limit) => {
    let step = 0;
    for (let it = 0; it < limit; it++) {
      step = 0;
      for (let k = 0; k < m; k++) {
        // Horner for q(z_k), and the product of the other differences.
        let vr = 1, vi = 0;
        for (let i = m - 1; i >= 0; i--) {
          const tr = vr * zr[k] - vi * zi[k] + qr[i];
          vi = vr * zi[k] + vi * zr[k] + qi[i];
          vr = tr;
        }
        let dr = 1, di = 0;
        for (let j = 0; j < m; j++) {
          if (j === k) continue;
          const er = zr[k] - zr[j], ei = zi[k] - zi[j];
          const tr = dr * er - di * ei;
          di = dr * ei + di * er;
          dr = tr;
        }
        const dd = dr * dr + di * di || 1e-30;
        const sr = (vr * dr + vi * di) / dd, si = (vi * dr - vr * di) / dd;
        zr[k] -= sr;
        zi[k] -= si;
        step = max(step, abs(sr) + abs(si));
      }
      if (step < 1e-9) return true;
    }
    return step < 1e-6;
  };
  const start = () => {
    let cx = 0, cy = 0, rr = 0;
    for (let k = 0; k < n; k++) { cx += ax[k] / n; cy += ay[k] / n; }
    for (let k = 0; k < n; k++) rr += sqrt((ax[k] - cx) ** 2 + (ay[k] - cy) ** 2) / n;
    for (let k = 0; k < m; k++) {
      zr[k] = cx + 0.5 * rr * cos((TAU * k) / m + 0.3);
      zi[k] = cy + 0.5 * rr * sin((TAU * k) / m + 0.3);
    }
  };
  if (!S.have) start();
  let ok = run(40);
  for (let k = 0; ok && k < m; k++) if (!(abs(zr[k]) < 50 && abs(zi[k]) < 50)) ok = false;
  if (!ok) {
    start();
    run(400);
    S.have = false;
  }
  for (let j = 0; j < m; j++) {
    let l = 0;
    for (let k = 0; k < n; k++) l += log((zr[j] - ax[k]) ** 2 + (zi[j] - ay[k]) ** 2) * 0.5;
    S.cv[j] = l;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, RMIN, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.2, 3);
  S.drift = cl(k[3], 0, 1);
  const n = cl(Math.round(k[2]), RMIN, RMAX);
  const fresh = n !== S.n;
  S.n = n;
  S.u += d * (S.speed / 2);
  S.phase += (d * (S.speed / 2) * TAU) / T_SWEEP;
  place(S);
  critical(S);
  const m = n - 1;
  let lo = 1e9, hi = -1e9;
  for (let j = 0; j < m; j++) {
    lo = min(lo, S.cv[j]);
    hi = max(hi, S.cv[j]);
  }
  S.lo = lo;
  S.hi = hi;
  // The sweep starts at the bottom: n separate loops, one per root.
  const sw = 0.5 - 0.5 * cos(S.phase);
  S.Lc = lo - MARGIN + (hi - lo + 2 * MARGIN) * sw;
  // A cross flashes the frame c passes its critical value, and the flash is
  // warm going up (two loops merge there) and cool going down (one splits).
  for (let j = 0; j < m; j++) {
    const sg = S.Lc > S.cv[j] ? 1 : -1;
    if (!fresh && S.have && S.sg[j] !== 0 && S.sg[j] !== sg) {
      S.fl[j] = 1;
      S.fd[j] = sg;
    }
    S.sg[j] = sg;
    S.fl[j] = max(0, S.fl[j] - d / 0.8);
  }
  if (fresh) {
    S.fl.fill(0);
    S.sg.fill(0);
    for (let j = 0; j < m; j++) S.sg[j] = S.Lc > S.cv[j] ? 1 : -1;
  }
  S.have = true;
}

function palette(S) {
  const h0 = S.hue + 0.46;
  for (let j = 0; j < PERIOD; j++) hsv(h0 + 0.5 * (1 - abs((2 * j) / PERIOD - 1)), 0.8, 0.85, S.pal, j * 3);
  S.palHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  if (S.palHue !== S.hue) palette(S);
  const { X, Y, R, G, B, pal, ax, ay, cv, cr, ci, fl, fd } = S;
  const n = S.n, m = n - 1, Lc = S.Lc, h0 = S.hue + 0.46;
  // One loop in every DL of log|p|: the loops stay about as far apart for
  // more roots, since far from the roots log|p| changes n times as fast.
  const DL = 0.13 * n, iDL = 1 / DL;
  // The tint inside the gold loop, and its colour.
  const fc = [0, 0, 0];
  // A dim orange reads as brown on the panel, so a tint that would land in red
  // to orange goes to crimson, and one in orange to yellow goes to green.
  let fh = h0 + 0.3;
  fh -= floor(fh);
  hsv(fh < 0.17 ? 0.94 + fh * 0.3 : fh < 0.3 ? 0.33 : fh, 0.8, 1, fc, 0);
  const gold = [1, 0.74, 0.18];
  let q = 0;
  for (let iy = 0; iy < H; iy++) {
    const y = Y[iy];
    for (let ix = 0; ix < W; ix++, q++) {
      const x = X[ix];
      let L = 0, sx = 0, sy = 0;
      for (let k = 0; k < n; k++) {
        const dx = x - ax[k], dy = y - ay[k], d2 = dx * dx + dy * dy + 1e-9, iv = 1 / d2;
        L += log(d2);
        sx += dx * iv;
        sy -= dy * iv;
      }
      L *= 0.5;
      // |grad log|p|| = |p'/p| = |sum of 1 / (z - a_k)|, so the distance in LEDs
      // to the level l is |log|p| - l| PX / |p'/p|.
      const g = sqrt(sx * sx + sy * sy) + 1e-6, kpx = PX / g;
      const u = L * iDL, fu = floor(u), f = u - fu;
      const dA = f * DL * kpx, dB = (1 - f) * DL * kpx;
      // Loops closer than about two LEDs would only beat against the grid.
      const dens = sm((DL * kpx - 1.7) / 2.4);
      let r = 0, gg = 0, b = 0;
      // Inside the gold loop: a tint that deepens toward the roots.
      if (L < Lc) {
        const w = 0.1 + 0.2 * (1 - exp(-(Lc - L) / (0.35 * n)));
        r = fc[0] * w;
        gg = fc[1] * w;
        b = fc[2] * w;
      }
      // Each level loop lit on its inside, a soft rim that fades toward the roots.
      const jn = dA < dB ? fu : fu + 1, dn = dA < dB ? dA : dB;
      const o = (((jn % PERIOD) + PERIOD) % PERIOD) * 3;
      const oj = ((((fu + 1) % PERIOD) + PERIOD) % PERIOD) * 3;
      const tail = 0.45 * exp(-dB / 3.2) * dens;
      r += pal[oj] * tail;
      gg += pal[oj + 1] * tail;
      b += pal[oj + 2] * tail;
      const ln = cl(1 - dn / 0.95, 0, 1) * dens;
      if (ln > 0) {
        r += (pal[o] - r) * ln;
        gg += (pal[o + 1] - gg) * ln;
        b += (pal[o + 2] - b) * ln;
      }
      // The level through each critical point, thin, in the cross's colour: it
      // crosses itself there.
      let dc = 1e9, jc = 0;
      for (let j = 0; j < m; j++) {
        const dj = abs(L - cv[j]);
        if (dj < dc) {
          dc = dj;
          jc = j;
        }
      }
      const cc = cl(1 - dc * kpx / 0.95, 0, 1) * 0.85;
      if (cc > 0) {
        const wm = S.sg[jc] > 0;
        r += ((wm ? 1 : 0.5) - r) * cc;
        gg += ((wm ? 0.88 : 0.85) - gg) * cc;
        b += ((wm ? 0.6 : 1) - b) * cc;
      }
      // The gold lemniscate.
      const dG = abs(L - Lc) * kpx;
      // It is wider than the others and white-hot in the middle, so it stays the
      // brightest line when the rainbow turns through gold.
      const gl = cl(1.7 - dG, 0, 1), ga = 0.3 * exp(-dG / 2.2), hot = cl(1.2 - dG / 0.6, 0, 1);
      r += gold[0] * ga;
      gg += gold[1] * ga;
      b += gold[2] * ga;
      if (gl > 0) {
        r += (gold[0] + (1 - gold[0]) * hot - r) * gl;
        gg += (gold[1] + (0.97 - gold[1]) * hot - gg) * gl;
        b += (gold[2] + (0.8 - gold[2]) * hot - b) * gl;
      }
      R[q] = r;
      G[q] = gg;
      B[q] = b;
    }
  }
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const p = y * W + x;
    R[p] += (r - R[p]) * a;
    G[p] += (g - G[p]) * a;
    B[p] += (b - B[p]) * a;
  };
  // The roots, small warm dots.
  for (let k = 0; k < n; k++) {
    const cx = floor(32 + ax[k] * PX), cy = floor(64 - ay[k] * PX);
    put(cx, cy, 1, 0.95, 0.85, 1);
    put(cx - 1, cy, 1, 0.95, 0.85, 0.55);
    put(cx + 1, cy, 1, 0.95, 0.85, 0.55);
    put(cx, cy - 1, 1, 0.95, 0.85, 0.55);
    put(cx, cy + 1, 1, 0.95, 0.85, 0.55);
  }
  // The critical points: a cross, gold-white once c has passed its value (the
  // saddle is inside the blob) and cool while it has not, flaring when c crosses.
  for (let j = 0; j < m; j++) {
    const cx = floor(32 + cr[j] * PX), cy = floor(64 - ci[j] * PX);
    const inside = S.sg[j] > 0, f = fl[j];
    const cr0 = inside ? 1 : 0.55, cg0 = inside ? 0.9 : 0.85, cb0 = inside ? 0.55 : 1;
    const arm = 3 + (f > 0 ? 2 : 0);
    for (let a = 1; a <= arm; a++) {
      const al = a === arm && f <= 0 ? 0.7 : 1;
      put(cx + a, cy, cr0, cg0, cb0, al);
      put(cx - a, cy, cr0, cg0, cb0, al);
      put(cx, cy + a, cr0, cg0, cb0, al);
      put(cx, cy - a, cr0, cg0, cb0, al);
    }
    put(cx, cy, 1, 1, 1, 1);
    if (f > 0) {
      // A ring that opens out from the cross while it flashes.
      const rr = (1 - f) * 9 + 2, w = f;
      const wr = fd[j] > 0 ? 1 : 0.6, wg = fd[j] > 0 ? 0.95 : 1, wb = fd[j] > 0 ? 0.7 : 1;
      for (let a = 0; a < 40; a++) {
        const t = (a / 40) * TAU;
        put(floor(cx + 0.5 + rr * cos(t)), floor(cy + 0.5 + rr * sin(t)), wr, wg, wb, w);
      }
      put(cx, cy, 1, 1, 1, 1);
      put(cx + 1, cy, wr, wg, wb, w);
      put(cx - 1, cy, wr, wg, wb, w);
      put(cx, cy + 1, wr, wg, wb, w);
      put(cx, cy - 1, wr, wg, wb, w);
    }
  }
  // The gauge down the right edge is log c. Each critical value is a tick, warm
  // once c is above it, and the gold marker travels up and down past them.
  const gx = W - 4, span = S.hi - S.lo + 2 * MARGIN, row = (l) => floor(123 - ((l - (S.lo - MARGIN)) / span) * 118);
  for (let y = 2; y < H - 2; y++)
    for (let x = gx; x < W; x++) {
      const p = y * W + x;
      R[p] *= 0.3;
      G[p] *= 0.3;
      B[p] *= 0.3;
    }
  for (let y = 2; y < H - 2; y++) put(W - 1, y, 0.35, 0.4, 0.55, 0.5);
  for (let j = 0; j < m; j++) {
    const y = row(cv[j]), f = fl[j], inside = S.sg[j] > 0;
    for (let x = gx; x < W - 1; x++) put(x, y, f > 0 ? 1 : inside ? 1 : 0.5, f > 0 ? 1 : inside ? 0.88 : 0.85, f > 0 ? 1 : inside ? 0.6 : 1, 1);
  }
  const ym = row(Lc);
  for (let x = gx - 1; x < W; x++) put(x, ym, gold[0], gold[1], gold[2], 1);
  put(gx - 1, ym - 1, gold[0], gold[1], gold[2], 0.6);
  put(gx - 1, ym + 1, gold[0], gold[1], gold[2], 0.6);
  for (let p = 0; p < N; p++) display.setPixel(p & 63, p >> 6, min(255, R[p] * 255), min(255, G[p] * 255), min(255, B[p] * 255));
}
