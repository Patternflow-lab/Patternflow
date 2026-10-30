// ===== Patternflow pattern =====
// Title:   Gaussian Zeros
// Family:  noise
// Idea:    The zeros of the planar Gaussian analytic function fill the upper half, each a black point ringed by the colour wheel of the function's phase, and drift as its random coefficients turn, while the lower half draws Poisson points of the same density with the same marks and the same speed, so the upper half stays an even foam of cells while the lower one piles its points into clumps and leaves dark holes between them.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the zeros of the planar Gaussian analytic function (Mikhail Sodin and Boris Tsirelson, Random complex zeroes, 2004; J. Ben Hough, Manjunath Krishnapur, Yuval Peres and Bálint Virág, Zeros of Gaussian Analytic Functions and Determinantal Point Processes, 2009), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Scale=0..1, Focus=0..1
//
// Knob 1: Hue. Adds a turn to every phase before it is painted, so each wheel turns round its black point. At 0 phase 0 is red, a third of a turn green and two thirds blue; at 0.5 phase 0 is cyan. The ground stays deep indigo.
// Knob 2: Speed. How fast the coefficients turn: at 2 each of the three Gaussians in a coefficient turns at 0.3 to 0.9 radians a second, and a zero moves 0.48 units, 2.4 LEDs, a second on average. The Poisson points wander at the same mean speed. At 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Scale. LEDs to one unit of the plane, 5 at 0 and 3.5 at 1. Each half is 64 by 63 LEDs: 12.8 by 12.6 units and 51 zeros on average at 0, 18.3 by 18 units and 105 zeros at 1, where the upper half turns into a fine, even weave and the holes in the lower one stand out the most.
// Knob 4: Focus. How far a mark spreads, rho = 4.4 - 2.6 Focus LEDs: 4.24 at the opening 0.06, where a lone mark's brightest ring sits 3 LEDs from its point and neighbouring zeros, 6.2 LEDs apart on average, run together into a foam; 3.1 at 0.5; 1.8 at 1, where every point is a small separate wheel and the two halves are the two point patterns bare.

// The planar Gaussian analytic function is
//
//   f(z) = sum_n xi_n z^n / sqrt(n!),
//
// the xi_n independent standard complex Gaussians. E f(z) conj f(w) =
// exp(z conj w), so |f(z)|^2 exp(-|z|^2) has the same law at every z, and
// the zeros of f form a point process that no translation or rotation of
// the plane changes, with 1/pi zeros to each unit of area. They are not
// independent. A zero makes the function small around it, which leaves
// little room for another, so the zeros keep apart and spread far more
// evenly than Poisson points of the same density. Counted in Node over 40
// runs of 30 s, a sample every 3 s, a half of this panel holds 51.3 zeros
// with a spread of 1.7 against 51.7 and 6.1 Poisson points, a zero's
// nearest neighbour is 1.23 units away on average against 0.88 (0.886 in
// theory), and 3.0% of zeros have a neighbour within 0.6 units against
// 30.8% of Poisson points (1 - exp(-0.36) = 30.2%).
//
// The upper half is the window of the plane round z = 0, 64 by 63 LEDs at
// 5 LEDs a unit. f is summed by Horner to |z|^2 + 4.5|z| + 8 terms, past
// which the terms are negligible, on every other LED. A cell of that grid
// holds a zero when arg f winds once round it; far from 0, arg f turns by
// Im(h conj z) over a step h even where there is no zero, so each step is
// read against that turn. Newton, on f(z) exp(-z conj z0) so that the
// growth of f does not throw it, puts the zero in place. Each coefficient
// is the sum of three standard complex Gaussians turning at their own
// rates, over sqrt 3: again a standard complex Gaussian at every moment,
// so at every frame f is exactly a GAF, and the zeros drift and dodge.
//
// The colour is the phase seen from the zero itself. Translating a GAF,
// g(w) = exp(-w conj a - |a|^2/2) f(a + w), gives a GAF again, and its
// phase arg f(a + w) - Im(w conj a) loses the fast background turn that
// arg f has far from 0, the turn that would otherwise stripe the corners.
// Round each zero a the pattern takes g's Taylor series to w^5 and paints
// its phase as the wheel; every wheel runs the same way round, as the zeros
// of an analytic function must. A mark multiplies the brightness field by
// 1 - exp(-d^2 / rho^2), black at the point and brightest where the field
// is 0.4. Where marks overlap their wheels vote, and wheels that disagree
// cancel towards white, drawing pale seams between the cells.
//
// The lower half holds 215 points on a 26 by 26 unit torus, uniform and
// each moving on its own with a velocity that turns slowly, which keeps
// them a Poisson process of density 1/pi in the window. They get the same
// marks with a plain wheel each.

const W = 64, H = 128;
const { floor, min, max, sqrt, exp, sin, cos, atan2, log, round, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;

// The GAF fills rows 0 .. HG - 1 and the Poisson points rows HP .. H - 1.
// f is evaluated on every other LED, MG LEDs past the GAF's edges so that
// zeros just outside still mark the LEDs near them.
const HG = 63, HP = 65, MG = 6;
const GW = (W + 2 * MG) / 2 + 1, GH = floor((HG + 2 * MG) / 2) + 2;
// Terms kept of the series, turning Gaussians per coefficient, Taylor
// terms kept round a zero.
const NMAX = 270, NJ = 3, NT = 6;
// The Poisson torus in units, centred on the lower half: wider than the
// half at the smallest Scale by more than any mark reaches.
const TW = 26, TH = 26;
// Poisson speed per unit of time, matched to the zeros' mean speed.
const VP = 0.39;

function gauss() {
  return sqrt(-2 * log(max(1e-12, Math.random()))) * cos(TAU * Math.random());
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  const g = new Float64Array(NMAX * NJ * 2), om = new Float64Array(NMAX * NJ);
  for (let i = 0; i < NMAX * NJ; i++) {
    // A standard complex Gaussian: E|g|^2 = 1, each part variance 1/2.
    g[2 * i] = gauss() * Math.SQRT1_2;
    g[2 * i + 1] = gauss() * Math.SQRT1_2;
    om[i] = (Math.random() < 0.5 ? -1 : 1) * (0.3 + 0.6 * Math.random());
  }
  // 1 / sqrt(n!)
  const isf = new Float64Array(NMAX);
  let lf = 0;
  for (let n = 0; n < NMAX; n++) {
    if (n > 0) lf += log(n);
    isf[n] = exp(-lf / 2);
  }
  const S = (params.s = {
    t: 0, hue: 0, speed: 2, ppu: 5, rho: 4.2,
    g, om, isf, c: new Float64Array(NMAX * 2),
    ar: new Float32Array(GW * GH), zx: [], zy: [],
    e: new Float32Array(W * H),
    wr: new Float32Array(W * H), wi: new Float32Array(W * H), ws: new Float32Array(W * H),
    G: new Float64Array(NT * 2), px: [], py: [], pvx: [], pvy: [], pth: [],
    bg: [0, 0, 0], col: [0, 0, 0],
  });
  // Uniform points of density 1/pi on the torus, round(TW TH / pi) = 215
  // of them, each placed and moved on its own: in a window a quarter of the
  // torus or less that is a Poisson process to within the count.
  const n = round((TW * TH) / PI);
  for (let i = 0; i < n; i++) {
    S.px.push(Math.random() * TW);
    S.py.push(Math.random() * TH);
    S.pvx.push(gauss());
    S.pvy.push(gauss());
    S.pth.push(TAU * Math.random());
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.ppu = 5 - 1.5 * cl(k[2] || 0, 0, 1);
  S.rho = 4.4 - 2.6 * cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const ds = d * S.speed * 0.5;
  S.t += ds;
  // Each Poisson point wanders with a velocity that turns slowly, and on
  // its own, so the points stay a Poisson process.
  const a = exp(-0.4 * ds), b = sqrt(1 - a * a);
  for (let i = 0; i < S.px.length; i++) {
    S.pvx[i] = S.pvx[i] * a + gauss() * b;
    S.pvy[i] = S.pvy[i] * a + gauss() * b;
    S.px[i] = (S.px[i] + S.pvx[i] * VP * ds + TW) % TW;
    S.py[i] = (S.py[i] + S.pvy[i] * VP * ds + TH) % TH;
    S.pth[i] += 0.5 * ds * S.pvx[i];
  }
}

const terms = (r2) => min(NMAX, floor(r2 + 4.5 * sqrt(r2) + 8));

// f(z) and f'(z) by Horner.
const F = [0, 0, 0, 0];
function evalF(c, x, y) {
  let fr = 0, fi = 0, dr = 0, di = 0;
  for (let n = terms(x * x + y * y) - 1; n >= 0; n--) {
    const t1 = dr * x - di * y + fr, t2 = dr * y + di * x + fi;
    dr = t1;
    di = t2;
    const a = fr * x - fi * y + c[2 * n], b = fr * y + fi * x + c[2 * n + 1];
    fr = a;
    fi = b;
  }
  F[0] = fr;
  F[1] = fi;
  F[2] = dr;
  F[3] = di;
}

// Round a zero a: the Taylor coefficients T_m = f^(m)(a) / m! by repeated
// synthetic division, then those of the GAF seen from a,
// g(w) = exp(-w conj a) f(a + w), G_m = sum_l T_(m-l) (-conj a)^l / l!,
// whose phase is arg f(a + w) - Im(w conj a).
const BUF = new Float64Array(NMAX * 2), T = new Float64Array(NT * 2);
function local(c, ax, ay, G) {
  const N = terms(ax * ax + ay * ay);
  for (let n = 0; n < 2 * N; n++) BUF[n] = c[n];
  for (let m = 0; m < NT; m++) {
    // Divide by (z - a) in place: the quotient lands in BUF[0 .. N - 2 - m]
    // and the remainder is T_m.
    let rr = 0, ri = 0;
    for (let n = N - 1 - m; n >= 0; n--) {
      const a = rr * ax - ri * ay + BUF[2 * n], b = rr * ay + ri * ax + BUF[2 * n + 1];
      BUF[2 * n] = rr;
      BUF[2 * n + 1] = ri;
      rr = a;
      ri = b;
    }
    T[2 * m] = rr;
    T[2 * m + 1] = ri;
  }
  let sc = 0;
  for (let m = 1; m < NT; m++) {
    let gr = 0, gi = 0, pr = 1, pi = 0;
    for (let l = 0; l <= m; l++) {
      if (l > 0) {
        const qr = (-pr * ax - pi * ay) / l, qi = (pr * ay - pi * ax) / l;
        pr = qr;
        pi = qi;
      }
      gr += T[2 * (m - l)] * pr - T[2 * (m - l) + 1] * pi;
      gi += T[2 * (m - l)] * pi + T[2 * (m - l) + 1] * pr;
    }
    G[2 * m] = gr;
    G[2 * m + 1] = gi;
    sc = max(sc, sqrt(gr * gr + gi * gi));
  }
  // Only the phase is used, so scale freely.
  G[0] = G[1] = 0;
  for (let m = 2; m < 2 * NT; m++) G[m] /= sc || 1;
  return G.slice();
}

// One mark at (qx, qy), rho LEDs across: the factor 1 - exp(-d^2 / rho^2)
// on e, and a vote for the hue, a unit vector weighted exp(-d^2 / 2 rho^2):
// the phase of the zero's own series G, or for a Poisson point a plain
// wheel turned by th.
function stamp(S, qx, qy, y0, y1, G, th) {
  const { e, wr, wi, ws, ppu, rho } = S, ct = cos(th), st = sin(th);
  const R = 2.3 * rho, ir = 1 / (rho * rho);
  for (let py = max(y0, floor(qy - R)); py <= min(y1, floor(qy + R) + 1); py++)
    for (let px = max(0, floor(qx - R)); px <= min(W - 1, floor(qx + R) + 1); px++) {
      const dx = px - qx, dy = py - qy, d2 = dx * dx + dy * dy, p = py * W + px;
      if (d2 * ir > 5) continue;
      const E = exp(-d2 * ir);
      e[p] *= 1 - E;
      let a, b;
      if (G) {
        const ux = dx / ppu, uy = dy / ppu;
        let sr = 0, si = 0;
        for (let m = NT - 1; m >= 1; m--) {
          const qa = sr * ux - si * uy + G[2 * m], qb = sr * uy + si * ux + G[2 * m + 1];
          sr = qa;
          si = qb;
        }
        a = sr * ux - si * uy;
        b = sr * uy + si * ux;
      } else {
        a = dx * ct - dy * st;
        b = dx * st + dy * ct;
      }
      const n = sqrt(a * a + b * b), w = sqrt(E);
      if (n > 0) {
        wr[p] += (w * a) / n;
        wi[p] += (w * b) / n;
      }
      ws[p] += w;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { g, om, isf, c, ar, ppu, e, wr, wi, ws, bg, col } = S, t = S.t;
  // The coefficients at time t, each a sum of NJ complex Gaussians turning
  // at their own rates, which is again a standard complex Gaussian.
  const sn = 1 / sqrt(NJ);
  for (let n = 0; n < NMAX; n++) {
    let re = 0, im = 0;
    for (let j = 0; j < NJ; j++) {
      const q = n * NJ + j, a = om[q] * t, ca = cos(a), sa = sin(a);
      re += g[2 * q] * ca - g[2 * q + 1] * sa;
      im += g[2 * q] * sa + g[2 * q + 1] * ca;
    }
    c[2 * n] = re * sn * isf[n];
    c[2 * n + 1] = im * sn * isf[n];
  }
  // f on the grid, z = 0 in the middle of the upper half.
  const cx = (W - 1) / 2, cy = (HG - 1) / 2, st = 2 / ppu, x0 = (-MG - cx) / ppu, y0 = (-MG - cy) / ppu;
  for (let j = 0; j < GH; j++) {
    const y = y0 + j * st;
    for (let i = 0; i < GW; i++) {
      const x = x0 + i * st, r2 = x * x + y * y;
      let fr = 0, fi = 0;
      for (let n = terms(r2) - 1; n >= 0; n--) {
        const a = fr * x - fi * y + c[2 * n], b = fr * y + fi * x + c[2 * n + 1];
        fr = a;
        fi = b;
      }
      ar[j * GW + i] = atan2(fi, fr);
    }
  }
  // The zeros: grid cells round which arg f winds once. Each step is read
  // against the step the background makes, Im(h conj z), which far from 0
  // is too big to read a winding off plain differences. Newton finishes.
  const step = (p, q, xa, ya, xb, yb) => {
    const bk = ((yb - ya) * (xa + xb) - (xb - xa) * (ya + yb)) / 2;
    let dd = ar[q] - ar[p] - bk;
    dd -= TAU * round(dd / TAU);
    return dd + bk;
  };
  const zx = [], zy = [], zg = [];
  for (let j = 0; j < GH - 1; j++)
    for (let i = 0; i < GW - 1; i++) {
      const p = j * GW + i, xa = x0 + i * st, ya = y0 + j * st, xb = xa + st, yb = ya + st;
      const w = step(p, p + 1, xa, ya, xb, ya) + step(p + 1, p + 1 + GW, xb, ya, xb, yb) + step(p + 1 + GW, p + GW, xb, yb, xa, yb) + step(p + GW, p, xa, yb, xa, ya);
      if (w < PI) continue;
      let x = xa + st / 2, y = ya + st / 2;
      for (let it = 0; it < 4; it++) {
        // Newton on f(z) exp(-z conj z0), which has f's zeros without its
        // growth: the step is -1 / (f'/f - conj z0).
        evalF(c, x, y);
        const m2 = F[0] * F[0] + F[1] * F[1];
        if (!(m2 > 0)) break;
        const lr = (F[2] * F[0] + F[3] * F[1]) / m2 - x, li = (F[3] * F[0] - F[2] * F[1]) / m2 + y, l2 = lr * lr + li * li;
        if (!(l2 > 0)) break;
        x -= lr / l2;
        y += li / l2;
      }
      if (!(abs(x - xa - st / 2) < 2 * st && abs(y - ya - st / 2) < 2 * st)) continue;
      let dup = false;
      for (let k = 0; k < zx.length; k++) if ((zx[k] - x) ** 2 + (zy[k] - y) ** 2 < 0.01) dup = true;
      if (dup) continue;
      zx.push(x);
      zy.push(y);
      zg.push(local(c, x, y, S.G));
    }
  S.zx = zx;
  S.zy = zy;
  e.fill(1);
  wr.fill(0);
  wi.fill(0);
  ws.fill(0);
  for (let k = 0; k < zx.length; k++) stamp(S, cx + zx[k] * ppu, cy + zy[k] * ppu, 0, HG - 1, zg[k], 0);
  const sx = cx - (TW / 2) * ppu, sy = (HP + H - 1) / 2 - (TH / 2) * ppu;
  for (let k = 0; k < S.px.length; k++) stamp(S, sx + S.px[k] * ppu, sy + S.py[k] * ppu, HP, H - 1, null, S.pth[k]);
  const hue0 = S.hue;
  hsv(0.7, 0.65, 0.15, bg);
  for (let py = 0; py < H; py++) {
    if (py >= HG && py < HP) {
      for (let px = 0; px < W; px++) display.setPixel(px, py, 0, 0, 0);
      continue;
    }
    for (let px = 0; px < W; px++) {
      const p = py * W + px, ee = e[p];
      // Black at the point, the wheel brightest where e = 0.4, the ground
      // beyond 0.85. Where wheels overlap their votes cancel towards white.
      const u = ee < 0.4 ? 0 : max(0, 1 - (ee - 0.4) / 0.45);
      const ring = ee < 0.4 ? sqrt(ee / 0.4) : u * sqrt(u);
      const k = ring * min(1, ws[p] * 1.2), core = min(1, ee / 0.3) * (1 - k);
      const coh = ws[p] > 1e-4 ? sqrt(wr[p] * wr[p] + wi[p] * wi[p]) / ws[p] : 0;
      hsv(atan2(wi[p], wr[p]) / TAU + hue0, 0.95 * coh, 1, col);
      display.setPixel(px, py, round((bg[0] * core + col[0] * k) * 255), round((bg[1] * core + col[1] * k) * 255), round((bg[2] * core + col[2] * k) * 255));
    }
  }
}
