// ===== Patternflow pattern =====
// Title:   Canard Explosion
// Family:  rhythm
// Idea:    The van der Pol oscillator walks through its family of limit cycles from a tiny Hopf cycle round the fold of the cubic, through ducks that ride the repelling middle branch further and further before jumping back, to ducks with a head and the full relaxation loop, each cycle left in the phase plane as a fading band so the family stands as nested loops, while x(t) runs down the lower panel and turns from small ripples into wide square spikes.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: relaxation oscillations (Balthasar van der Pol, 1926), the Lienard plane (Alfred-Marie Lienard, 1928), canard cycles and the canard explosion (Eric Benoit, Jean-Louis Callot, Francine Diener and Marc Diener, 1981), the explosion by geometric singular perturbation (Martin Krupa and Peter Szmolyan, 2001), pattern round 61
// Round:   61
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Epsilon=0.04..0.2, Pace=0.6..3
//
// Knob 1: Hue. Turns the family's colours round the wheel. At 0 the smallest cycles are teal, the ducks azure to violet and the relaxation loop magenta, over attracting branches drawn green and a dashed repelling branch drawn rose; at 0.5 the family runs from violet through red to lime and cyan. The wheel skips orange, which reads brown when dim.
// Knob 2: Speed. At 2 the oscillator runs 2.5 units of its slow time a second: a Hopf cycle goes round in 0.5 s, the relaxation loop in 1.6 s and the longest duck in 2 s, and the trace below moves 15 rows a second. At 0.2 everything runs ten times slower, at 3 half as fast again.
// Knob 3: Epsilon. The ratio of the fast time to the slow, 0.04 to 0.2, in eps x' = y - (x^3 / 3 - x), y' = a - x. At 0.04 the ducks are sharp: every cycle from the duck that turns back at x = 0 to the one whose head reaches x = -1.47 lies in an interval of a 1.8e-11 wide at a = 0.9948377923, the jumps are flat and the corners square. At 0.1 the same stretch of the family is 1.3e-4 wide and the loops round off; at 0.2 it is 0.023 wide, the ducks are fat and the relaxation loop reaches only x = -1.52. The family is found again by bisection a quarter second after the knob stops, 5 to 20 ms of work.
// Knob 4: Pace. How fast the walk goes through the family of 18 cycles (17 at eps = 0.2), 0.6 to 3 cycles a second at Speed 2, out and back with a pause at each end. The parameter a changes only as the point crosses x = a going right, so each cycle is run whole. A ghost fades by e in 4 seconds. At 0.6 a duck runs one or two loops before the next takes over and five or six earlier cycles still show; at 3 the walk moves on several cycles each loop and goes from the Hopf cycle to the relaxation loop in 6 seconds.

const W = 64, H = 128, PH = 76, T0 = 79, TH = H - T0;
// The phase plane: x from -XR to XR across, y from YT at the top to -YT.
// Both are fitted to the family of each eps: the loops overshoot the folds
// before they jump, up to y = 1.02 at eps = 0.04 and 1.57 at 0.2, so the
// plane runs to 1.08 and 1.66. use(S) sets them from the state before any
// drawing.
let XR = 2.2, YT = 1.1;
const use = (S) => {
  XR = S.xr;
  YT = S.yt;
};
const PX = (x) => ((x + XR) * W) / (2 * XR), PY = (y) => ((YT - y) * PH) / (2 * YT);
const { floor, ceil, min, max, abs, exp, sqrt, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// Slow time a second at Speed 2 is 2 x RATE; trace rows per unit of slow time.
const RATE = 1.25, TR = 6;
// Every bisection starts here on the right attracting branch. From x = 1.95
// the branch pulls the point onto the slow manifold by e^(-2.75 / eps)
// before the fold, below rounding error at eps = 0.04, so the canard that
// follows depends on a alone.
const X0 = 1.95;
const HOLD = 1.5, GHOST = 4;
const wheel = (h) => 0.28 + 0.74 * (h - floor(h));

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// One RK4 step of eps x' = y - (x^3/3 - x), y' = a - x. The live point and
// the bisection use this same step at the same h, so the cycle the
// bisection found is the cycle the point settles on.
let RX = 0, RY = 0;
function rk4(x, y, a, ie, h) {
  const k1x = (y - x * (x * x / 3 - 1)) * ie, k1y = a - x;
  let xx = x + 0.5 * h * k1x, yy = y + 0.5 * h * k1y;
  const k2x = (yy - xx * (xx * xx / 3 - 1)) * ie, k2y = a - xx;
  xx = x + 0.5 * h * k2x;
  yy = y + 0.5 * h * k2y;
  const k3x = (yy - xx * (xx * xx / 3 - 1)) * ie, k3y = a - xx;
  xx = x + h * k3x;
  yy = y + h * k3y;
  const k4x = (yy - xx * (xx * xx / 3 - 1)) * ie, k4y = a - xx;
  RX = x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  RY = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
}

// How far left the cycle reaches, from one pass: down the right branch,
// round the fold, along the middle branch and off. x_min runs from near 1
// for the smallest cycles through -1 at the maximal canard to about -1.9
// for the relaxation loop, so it orders the whole family.
function firstPass(a, ie, h) {
  let x = X0, y = X0 * (X0 * X0 / 3 - 1), xmin = 9, below = false;
  const M = ceil(14 / h);
  for (let i = 0; i < M; i++) {
    rk4(x, y, a, ie, h);
    const px = x;
    x = RX;
    y = RY;
    if (x < xmin) xmin = x;
    if (x < a) below = true;
    else if (below && px < a) return xmin;
  }
  return xmin;
}

// Run until the loops agree, then keep one loop, crossing to crossing of
// x = a going right.
function settle(a, ie, h, most) {
  let x = X0, y = X0 * (X0 * X0 / 3 - 1), xmin = 9, prev = 9, below = false, loops = 0, rec = null, n = 0;
  const M = ceil(400 / h);
  for (let i = 0; i < M; i++) {
    rk4(x, y, a, ie, h);
    const px = x;
    x = RX;
    y = RY;
    if (rec) {
      if (n < rec.length / 2) {
        rec[2 * n] = x;
        rec[2 * n + 1] = y;
        n++;
      }
    }
    if (x < xmin) xmin = x;
    if (x < a) below = true;
    else if (below && px < a) {
      if (rec) return { a, pts: rec, n, xmin, period: n * h };
      loops++;
      if ((loops >= 2 && abs(xmin - prev) < 3e-4) || loops >= most) rec = new Float32Array(2 * ceil(12 / h));
      prev = xmin;
      xmin = 9;
      below = false;
    }
  }
  return { a, pts: rec || new Float32Array(2), n, xmin: prev, period: n * h };
}

// Max-blend an antialiased segment into a PH-row raster.
function seg(buf, x0, y0, x1, y1, v, rows) {
  const n = max(1, ceil(max(abs(x1 - x0), abs(y1 - y0)) * 2));
  for (let s = 0; s <= n; s++) {
    const f = s / n, x = x0 + (x1 - x0) * f - 0.5, y = y0 + (y1 - y0) * f - 0.5;
    const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
    for (let k = 0; k < 4; k++) {
      const xx = xi + (k & 1), yy = yi + (k >> 1);
      if (xx < 0 || xx >= W || yy < 0 || yy >= rows) continue;
      const w = v * ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy) * 1.6;
      const o = yy * W + xx;
      if (w > buf[o]) buf[o] = min(1, w);
    }
  }
}

function rasterize(m) {
  const stroke = new Float32Array(W * PH), inside = new Uint8Array(W * PH), xs = [];
  for (let r = 0; r < PH; r++) xs.push([]);
  const P = m.pts, n = m.n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, x0 = PX(P[2 * i]), y0 = PY(P[2 * i + 1]), x1 = PX(P[2 * j]), y1 = PY(P[2 * j + 1]);
    seg(stroke, x0, y0, x1, y1, 1, PH);
    // Scanline crossings at row centres, for the even-odd fill.
    const lo = min(y0, y1), hi = max(y0, y1);
    for (let r = ceil(lo - 0.5); r + 0.5 < hi; r++) {
      if (r < 0 || r >= PH) continue;
      const yc = r + 0.5;
      if (yc < lo || yc >= hi) continue;
      xs[r].push(x0 + ((x1 - x0) * (yc - y0)) / (y1 - y0));
    }
  }
  for (let r = 0; r < PH; r++) {
    const c = xs[r].sort((p, q) => p - q);
    for (let k = 0; k + 1 < c.length; k += 2)
      for (let x = max(0, ceil(c[k] - 0.5)); x < W && x + 0.5 < c[k + 1]; x++) inside[r * W + x] = 1;
  }
  m.stroke = stroke;
  m.inside = inside;
}

// The family for one eps: three Hopf cycles at a = 1 - f dc, where dc =
// eps / 8 + 3 eps^2 / 32 is the canard point to second order; fourteen
// ducks found by bisection on x_min, nine headless and five with a head;
// and the relaxation loop at a = 1 - 3 dc.
function family(S, eps) {
  const h = eps / 8, ie = 1 / eps, dc = eps / 8 + (3 * eps * eps) / 32;
  const samples = [];
  const meas = (a) => {
    const v = firstPass(a, ie, h);
    samples.push(a, v);
    return v;
  };
  const aLo = 1 - 3 * dc, aHi = 1 - 0.5 * dc;
  const xR = meas(aLo), xH = meas(aHi);
  const as = [1 - 0.15 * dc, 1 - 0.4 * dc, 1 - 0.65 * dc];
  const targets = [0.55, 0.38, 0.2, 0, -0.2, -0.4, -0.6, -0.78, -0.92];
  for (let j = 1; j <= 5; j++) targets.push(-1 + ((xR + 1) * j) / 5.6);
  for (const T of targets) {
    if (!(T < xH && T > xR)) continue;
    // The tightest bracket any earlier bisection left.
    let lo = aLo, hi = aHi;
    for (let i = 0; i < samples.length; i += 2) {
      const a = samples[i], v = samples[i + 1];
      if (v < T && a > lo) lo = a;
      if (v >= T && a < hi) hi = a;
    }
    for (let it = 0; it < 64; it++) {
      const mid = 0.5 * (lo + hi);
      if (mid <= lo || mid >= hi) break;
      const v = meas(mid);
      if (v < T) lo = mid;
      else hi = mid;
      if (abs(v - T) < 0.004) {
        hi = mid;
        break;
      }
    }
    as.push(hi);
  }
  as.push(aLo);
  const fam = [];
  let ex = 0, ey = 0;
  for (let i = 0; i < as.length; i++) {
    const m = settle(as[i], ie, h, i < 3 ? 80 : 4);
    if (m.n < 8) continue;
    m.hopf = i < 3;
    for (let j = 0; j < 2 * m.n; j += 2) {
      ex = max(ex, abs(m.pts[j]));
      ey = max(ey, abs(m.pts[j + 1]));
    }
    fam.push(m);
  }
  S.xr = max(2.2, 1.03 * ex);
  S.yt = 1.06 * ey;
  use(S);
  for (const m of fam) rasterize(m);
  cubicRasters(S);
  fam.sort((p, q) => q.xmin - p.xmin);
  // Each pixel takes the smallest cycle round it, so nested cycles leave
  // nested bands.
  const band = new Int8Array(W * PH).fill(-1);
  for (let k = fam.length - 1; k >= 0; k--) for (let p = 0; p < W * PH; p++) if (fam[k].inside[p]) band[p] = k;
  S.eps = eps;
  S.h = h;
  S.fam = fam;
  S.band = band;
  S.ghost = new Float32Array(fam.length);
  S.kc = cl(S.kc, 0, fam.length - 1);
  S.x = fam[S.kc].pts[0];
  S.y = fam[S.kc].pts[1];
}

function cubicRasters(S) {
  // The critical manifold y = x^3/3 - x: outer branches attract, the
  // middle one repels.
  const att = new Float32Array(W * PH), rep = new Float32Array(W * PH), side = new Uint8Array(W * PH);
  const f = (x) => x * (x * x / 3 - 1);
  for (let i = 0; i < 400; i++) {
    const x0 = -XR + (2 * XR * i) / 400, x1 = -XR + (2 * XR * (i + 1)) / 400;
    const mid = abs(0.5 * (x0 + x1)) < 1;
    // The repelling branch is dashed.
    if (mid && floor(i / 6) % 2) continue;
    seg(mid ? rep : att, PX(x0), PY(f(x0)), PX(x1), PY(f(x1)), 1, PH);
  }
  for (let r = 0; r < PH; r++)
    for (let c = 0; c < W; c++) {
      const x = ((c + 0.5) * 2 * XR) / W - XR, y = YT - ((r + 0.5) * 2 * YT) / PH;
      side[r * W + c] = y > f(x) ? 1 : 0;
    }
  S.att = att;
  S.rep = rep;
  S.side = side;
}

export function setup(params) {
  params.s = {
    eps: 0, h: 0, fam: [], band: null, ghost: null, kc: 0, walk: 0, dir: 1,
    x: X0, y: X0 * (X0 * X0 / 3 - 1), acc: 0, rowT: 0, cmin: 9, cmax: -9,
    tmin: new Float32Array(TH).fill(NaN), tmax: new Float32Array(TH), tk: new Int8Array(TH), ta: new Float32Array(TH), head: 0,
    tail: new Float32Array(512), ti: 0, tn: 0,
    xr: 2.2, yt: 1.1, wantEps: 0, still: 0, hue: 0, tl: new Float32Array(W * PH), rgb: new Float32Array(W * H * 3), c: [0, 0, 0], c2: [0, 0, 0],
  };
}

function pushRow(S) {
  S.head = (S.head + TH - 1) % TH;
  S.tmin[S.head] = S.cmin;
  S.tmax[S.head] = S.cmax;
  S.tk[S.head] = S.kc;
  S.ta[S.head] = S.fam[S.kc].a;
  S.cmin = S.cmax = S.x;
}

function sim(S, d, speed, pace) {
  const N = S.fam.length;
  S.walk += S.dir * pace * d * speed * 0.5;
  if (S.walk > N - 1 + HOLD) {
    S.walk = N - 1 + HOLD;
    S.dir = -1;
  } else if (S.walk < -HOLD) {
    S.walk = -HOLD;
    S.dir = 1;
  }
  const fade = exp(-(d * speed * 0.5) / GHOST);
  for (let k = 0; k < N; k++) S.ghost[k] *= fade;
  const h = S.h, ie = 1 / S.eps;
  S.acc += d * speed * RATE;
  let a = S.fam[S.kc].a;
  while (S.acc >= h) {
    S.acc -= h;
    const px = S.x;
    rk4(S.x, S.y, a, ie, h);
    S.x = RX;
    S.y = RY;
    if (px < a && S.x >= a && S.y > a * (a * a / 3 - 1)) {
      // A loop is done: the next cycle of the walk takes over here.
      const was = S.fam[S.kc];
      S.kc = cl(round(S.walk), 0, N - 1);
      const m = S.fam[S.kc];
      a = m.a;
      // Out of a Hopf cycle the point sits by the weakly unstable focus and
      // would take a dozen loops to spiral out to a duck, so it is set on
      // the new cycle where that cycle crosses x = a.
      if (was.hopf && !m.hopf) {
        S.x = m.pts[0];
        S.y = m.pts[1];
      }
    }
    S.ghost[S.kc] = 1;
    S.tail[S.ti] = S.x;
    S.tail[S.ti + 1] = S.y;
    S.ti = (S.ti + 2) % S.tail.length;
    S.tn = min(S.tn + 1, S.tail.length / 2);
    if (S.x < S.cmin) S.cmin = S.x;
    if (S.x > S.cmax) S.cmax = S.x;
    S.rowT += h * TR;
    if (S.rowT >= 1) {
      S.rowT -= 1;
      pushRow(S);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0.04, 0.6], d = cl(dt || 0, 0, 0.1);
  use(S);
  S.hue = cl(kv[0], 0, 1);
  const speed = cl(kv[1], 0.2, 3), eps = cl(kv[2], 0.04, 0.2), pace = cl(kv[3], 0.6, 3);
  if (!S.fam.length) {
    family(S, eps);
    // Open going up the walk at the duck that turns back near x = -0.5,
    // with up to eight seconds already run to get there, so the ghosts and
    // the trace are there from the first frame. At the opening Pace the
    // first duck with a head comes 6 seconds in.
    const N = S.fam.length, at = 0.5 * (N - 1), pre = min(8, (at + HOLD) / pace);
    S.walk = at - pace * pre;
    S.kc = cl(round(S.walk), 0, N - 1);
    const m = S.fam[S.kc];
    S.x = m.pts[0];
    S.y = m.pts[1];
    S.cmin = S.cmax = S.x;
    for (let i = 0; i < round(pre * 30); i++) sim(S, 1 / 30, 2, pace);
    S.wantEps = eps;
    return;
  }
  // A new eps is taken once the knob has rested for a quarter second.
  if (abs(eps - S.wantEps) > 1e-6) {
    S.wantEps = eps;
    S.still = 0;
  } else S.still += d;
  if (abs(S.wantEps - S.eps) > 1e-6 && S.still > 0.25) family(S, S.wantEps);
  sim(S, d, speed, pace);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.fam.length) return;
  use(S);
  const rgb = S.rgb, fam = S.fam, N = fam.length, c = S.c, c2 = S.c2, hue = S.hue;
  rgb.fill(0);
  const add = (o, col, v) => {
    rgb[o] += col[0] * v;
    rgb[o + 1] += col[1] * v;
    rgb[o + 2] += col[2] * v;
  };
  const colOf = (k, s, v, out) => hsv(wheel(0.22 + (0.58 * k) / max(1, N - 1) + hue), s, v, out);
  // The two sides of the cubic: above it the fast flow runs right, below it left.
  const up = hsv(wheel(0.25 + hue), 0.45, 0.1, [0, 0, 0]), dn = hsv(wheel(0.62 + hue), 0.45, 0.1, [0, 0, 0]);
  const cols = [];
  for (let k = 0; k < N; k++) cols.push(colOf(k, 0.75, 1, [0, 0, 0]));
  for (let p = 0; p < W * PH; p++) {
    const o = p * 3;
    add(o, S.side[p] ? up : dn, 1);
    const b = S.band[p];
    if (b >= 0) add(o, cols[b], 0.42 * S.ghost[b]);
  }
  // Ghost outlines.
  for (let k = 0; k < N; k++) {
    const g = S.ghost[k];
    if (g < 0.02 || k === S.kc) continue;
    const st = fam[k].stroke, col = cols[k];
    for (let p = 0; p < W * PH; p++) if (st[p] > 0) add(p * 3, col, st[p] * g * 0.6);
  }
  const att = hsv(wheel(0.07 + hue), 0.6, 0.42, [0, 0, 0]), rep = hsv(wheel(0.97 + hue), 0.6, 0.5, [0, 0, 0]);
  for (let p = 0; p < W * PH; p++) {
    if (S.att[p] > 0) add(p * 3, att, S.att[p]);
    if (S.rep[p] > 0) add(p * 3, rep, S.rep[p]);
  }
  // The cycle being run.
  colOf(S.kc, 0.35, 1, c);
  const st = fam[S.kc].stroke;
  for (let p = 0; p < W * PH; p++) if (st[p] > 0) add(p * 3, c, st[p] * 0.75);
  // The equilibrium at (a, f(a)), the centre the Hopf cycle grew from.
  const a = fam[S.kc].a, ex = PX(a), ey = PY(a * (a * a / 3 - 1));
  for (const [dx, dy, v] of [[0, 0, 0.7], [1, 0, 0.3], [-1, 0, 0.3], [0, 1, 0.3], [0, -1, 0.3]]) {
    const xx = floor(ex) + dx, yy = floor(ey) + dy;
    if (xx >= 0 && xx < W && yy >= 0 && yy < PH) add((yy * W + xx) * 3, rep, v * 2);
  }
  // The point and its last 0.3 units of slow time.
  const tl = S.tl.fill(0), L = min(S.tn - 1, ceil(0.3 / S.h)), TL = S.tail.length;
  for (let i = 0; i < L; i++) {
    const j0 = (S.ti - 2 * (i + 1) + 2 * TL) % TL, j1 = (S.ti - 2 * (i + 2) + 2 * TL) % TL;
    seg(tl, PX(S.tail[j0]), PY(S.tail[j0 + 1]), PX(S.tail[j1]), PY(S.tail[j1 + 1]), 1 - i / L, PH);
  }
  for (let p = 0; p < W * PH; p++) if (tl[p] > 0) add(p * 3, c, tl[p] * 0.9);
  const qx = PX(S.x), qy = PY(S.y);
  for (let yy = floor(qy - 3); yy <= qy + 3; yy++)
    for (let xx = floor(qx - 3); xx <= qx + 3; xx++) {
      if (xx < 0 || xx >= W || yy < 0 || yy >= PH) continue;
      const dx = xx + 0.5 - qx, dy = yy + 0.5 - qy, r2 = dx * dx + dy * dy;
      add((yy * W + xx) * 3, [1, 1, 1], 1.6 * exp(-r2 / 2.2));
    }
  // The axis between: ticks at x = -2, -1, 0, 1, 2 and a mark at x = a.
  const ax = hsv(wheel(0.5 + hue), 0.2, 1, c2);
  for (let x = 0; x < W; x++) add(((PH + 1) * W + x) * 3, ax, 0.12);
  for (let t = -2; t <= 2; t++) {
    const xx = floor(PX(t));
    for (let yy = PH; yy <= PH + 2; yy++) if (xx >= 0 && xx < W) add((yy * W + xx) * 3, ax, 0.35);
  }
  for (let yy = PH; yy <= PH + 2; yy++) add((yy * W + cl(floor(ex), 0, W - 1)) * 3, rep, 0.8);
  // x(t) running down, newest row on top, filled from the equilibrium
  // x = a out to the trace.
  for (let r = 0; r < TH; r++) {
    const i = (S.head + r) % TH, lo = S.tmin[i], hi = S.tmax[i];
    if (lo !== lo) continue;
    const k = S.tk[i], col = cols[min(k, N - 1)], e = PX(S.ta[i]), x0 = PX(lo), x1 = PX(hi), y = T0 + r;
    const age = 1 - (0.55 * r) / TH;
    // A faint rule across the trace where the next cycle of the family took over.
    const j = (i + 1) % TH;
    if (r < TH - 1 && S.tmin[j] === S.tmin[j] && S.tk[j] !== k) for (let x = 0; x < W; x++) add((y * W + x) * 3, col, 0.13 * age);
    const fl = min(e, x0), fr = max(e, x1);
    for (let x = max(0, floor(fl)); x < W && x < fr; x++) {
      const cx = x + 0.5;
      // Coverage of the pixel by the bright stroke [x0 - 0.5, x1 + 0.5].
      const sc = cl(min(cx + 0.5, x1 + 1) - max(cx - 0.5, x0 - 1), 0, 1);
      const fc = cl(min(cx + 0.5, fr) - max(cx - 0.5, fl), 0, 1);
      // The fill brightens from the equilibrium out to the trace.
      const q = abs(cx - e) / max(1, abs((cx < e ? x0 : x1) - e));
      add((y * W + x) * 3, col, age * ((0.2 + 0.36 * min(1, q)) * fc + 0.9 * sc));
    }
  }
  for (let p = 0, o = 0; p < W * H; p++, o += 3)
    display.setPixel(p % W, (p / W) | 0, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
}
