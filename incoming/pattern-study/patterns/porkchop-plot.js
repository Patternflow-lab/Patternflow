// ===== Patternflow pattern =====
// Title:   Porkchop Plot
// Family:  launchwindow
// Idea:    The launch-window chart of interplanetary mission design, drawn by really solving Lambert's problem for every launch date across and every flight time down: cheap transfers glow as a chain of closed islands with contour rings round them, and as the epoch runs and the destination planet wanders in and out the islands slide sideways and change their shape and spacing.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Lambert's problem (Johann Heinrich Lambert, 1761), solved here in Dario Izzo's x-variable form (2015, from memory; the same family as Battin's universal variables of the 1960s and Gooding's 1990 method), the minimum-energy transfer of Walter Hohmann (1925), and the porkchop plot of launch windows as NASA mission designers draw it (from memory); pattern round 225
// Round:   225
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Target=0..5, Epoch=1..8, Contour=-1..1
//
// Knob 1: Hue. Turns the colour ramp round the wheel. At 0 it runs from indigo in the costly far field through teal and lime to warm yellow at the cheapest transfer; at 0.5 it is the complement, from olive through rose to violet. On its own the ramp also drifts up to 0.17 of a turn and back over a few minutes.
// Knob 2: Target. The mean orbit radius of the destination in units of the departure orbit, 0.7 * 7.43^(K/5): 0.7 at 0 (inside, Venus-like), 1.56 at 2 where it opens (Mars-like), 3.2 at 4 and 5.2 at 5 (Jupiter-like). Islands come every 7 time units at 5, 13 at 2 and 9 at 0, and the target then wanders from this radius by as much as a factor of 1.7 either way over minutes.
// Knob 3: Epoch. How fast the launch dates scroll: 0.45 * K^1.1 time units a second, where one time unit is 1/6.28 of the departure planet's year. At 1 an island slides about 4 LEDs a second, at 8 about 40. Across the dark gap between islands the epoch runs up to 6 times as fast.
// Knob 4: Contour. Equal delta-v rings and the window of the colour ramp. At -1 there are 7 rings, each 1.43 times the delta-v of the one inside, and the ramp is wide; at 0.06 where it opens there are 14, 1.2 times apart; at +1 there are 27, 1.1 times apart, and the ramp is narrow, a dense topographic map.

const W = 64, H = 128;
const { floor, sqrt, exp, log, sin, cos, acos, asinh, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// The chart. One column of Lambert solves for each LED across (a launch date each),
// one row for every two LEDs down (a flight time each); rows in between are
// interpolated. Units: the departure planet's orbit has radius 1 and its speed is
// 1, so a time unit is 1/6.28 of its year and delta-v is a fraction of 29.8 km/s.
const NX = 64, NY = 64;
const TF_LO = 0.45, TF_HI = 1.65;  // flight time, top and bottom, in Hohmann times
const LATMAX = 1400;               // most sample points of the destination's ephemeris
const RMAX = 40;                   // delta-v is shown no higher than 40 times the Hohmann cost
const LTOP = 14;                   // contour rings stop at 14 times the Hohmann cost

function hsv(h, s, v, out, o) {
  h = h - floor(h);
  const i = floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

// Lambert's problem in the plane, prograde, one revolution at most. The departure
// planet sits at radius 1 in direction (c1, s1); the destination is at (X2, Y2).
// The unknown x runs from -1 (a very slow elliptic arc) through 0 (the minimum-energy
// ellipse for this chord) to 1 (parabola) and beyond (hyperbola); the time of flight
// falls steadily as x grows, so one root is bracketed and a third-order Householder
// step finds it in one to three rounds. Returns the total delta-v of leaving the
// departure orbit and joining the arrival one, or -1 when the root is not found.
function transferCost(c1, s1, X2, Y2, vrp, vtp, tof, wd, wa) {
  const r2 = sqrt(X2 * X2 + Y2 * Y2);
  const dx = X2 - c1, dy = Y2 - s1;
  let c = sqrt(dx * dx + dy * dy);
  if (c < 1e-9) c = 1e-9;
  const s = 0.5 * (1 + r2 + c);
  // Which way round: a destination counter-clockwise of the start by less than a
  // half turn is reached the short way (lambda > 0), otherwise the long way.
  const l2 = 1 - c / s > 0 ? 1 - c / s : 0;
  let lam = sqrt(l2);
  if (c1 * Y2 - s1 * X2 < 0) lam = -lam;
  const T = tof * sqrt(2 / (s * s * s));
  const l3 = lam * l2, l5 = l3 * l2, om1 = 1 - l2;
  const T0 = acos(lam) + lam * sqrt(om1), T1 = (2 / 3) * (1 - l3);
  let x;
  if (T >= T0) x = pow(T0 / T, 2 / 3) - 1;
  else if (T < T1) x = (2.5 * T1 * (T1 - T)) / (T * (1 - l5)) + 1;
  else x = pow(T / T0, 0.6931471805599453 / log(T1 / T0)) - 1;
  let lo = -0.995, hi = 1e4;
  for (let it = 0; it < 16; it++) {
    let om = 1 - x * x;
    // Right at the parabola the closed form loses its digits; stand 0.15% off it.
    if (om < 3e-3 && om > -3e-3) {
      x = x < 1 ? sqrt(1 - 3e-3) : sqrt(1 + 3e-3);
      om = 1 - x * x;
    }
    const y = sqrt(1 - l2 * om);
    let psi;
    if (x < 1) {
      const a = x * y + lam * om;
      psi = acos(a > 1 ? 1 : a < -1 ? -1 : a);
    } else psi = asinh((y - x * lam) * sqrt(-om));
    const Tx = (psi / sqrt(abs(om)) - x + lam * y) / om;
    const delta = Tx - T;
    if (delta > 0) lo = x;
    else hi = x;
    if (abs(delta) < 1e-9 * (1 + T)) break;
    const y3 = y * y * y;
    const DT = (3 * Tx * x - 2 + (2 * l3 * x) / y) / om;
    const DDT = (3 * Tx + 5 * x * DT + (2 * om1 * l3) / y3) / om;
    const DDDT = (7 * x * DDT + 8 * DT - (6 * om1 * l5 * x) / (y3 * y * y)) / om;
    const DT2 = DT * DT;
    let xn = x - (delta * (DT2 - (delta * DDT) / 2)) / (DT * (DT2 - delta * DDT) + (DDDT * delta * delta) / 6);
    if (!(xn > lo && xn < hi)) xn = hi > 1e3 ? (lo > 0 ? lo * 2 + 1 : 0.5 * (lo + 1)) : 0.5 * (lo + hi);
    if (abs(xn - x) < 1e-7) {
      x = xn;
      break;
    }
    x = xn;
  }
  const y = sqrt(1 - l2 + l2 * x * x);
  let rho = (1 - r2) / c;
  rho = rho > 1 ? 1 : rho < -1 ? -1 : rho;
  const gam = sqrt(s / 2);
  const ly = lam * y;
  const vt = gam * sqrt(1 - rho * rho) * (y + lam * x);
  const vr1 = gam * (ly - x - rho * (ly + x));
  const vr2 = (-gam * (ly - x + rho * (ly + x))) / r2;
  const d1 = vr1 * vr1 + (vt - 1) * (vt - 1);
  const d2 = (vr2 - vrp) * (vr2 - vrp) + (vt / r2 - vtp) * (vt / r2 - vtp);
  const dv = wd * sqrt(d1) + wa * sqrt(d2);
  return dv >= 0 && dv < 1e6 ? dv : -1;
}

// The cost of the Hohmann transfer from radius 1 to radius a, the cheapest
// transfer between two circular orbits and the scale every delta-v is shown against,
// with the departure burn weighted by wd and the arrival burn by wa.
function hohmann(a, wd, wa) {
  const at = 0.5 * (1 + a);
  const d1 = abs(sqrt(2 - 1 / at) - 1);
  const d2 = abs(1 / sqrt(a) - sqrt(2 / a - 1 / at));
  return wd * d1 + wa * d2;
}

// The destination on its orbit: position and velocity (radial and tangential parts)
// at `n` evenly spaced epochs from u0, as the planet's mean anomaly M0 + nn * u
// advances. One Kepler solve per point and a lookup per cell.
function ephemeris(P, u0, du, n, nn, M0, a, e, w) {
  const { LX, LY, LVR, LVT } = P;
  const cw = cos(w), sw = sin(w), q = sqrt(1 - e * e), ip = 1 / sqrt(a * (1 - e * e));
  for (let k = 0; k <= n; k++) {
    let M = M0 + nn * (u0 + k * du);
    M -= TAU * floor(M / TAU + 0.5);
    let E = M + e * sin(M);
    for (let i = 0; i < 3; i++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
    const ce = cos(E), se = sin(E), den = 1 / (1 - e * ce);
    const cn = (ce - e) * den, sn = q * se * den;
    const r = a * (1 - e * ce);
    LX[k] = r * (cw * cn - sw * sn);
    LY[k] = r * (sw * cn + cw * sn);
    LVR[k] = e * sn * ip;
    LVT[k] = (1 + e * cn) * ip;
  }
}

export function setup(params) {
  const P = params;
  P.t = 0;
  P.th1 = 0.4;     // longitude of the departure planet at the middle of the window
  P.M2 = 0.35;     // mean anomaly of the destination there
  P.LX = new Float32Array(LATMAX + 2);
  P.LY = new Float32Array(LATMAX + 2);
  P.LVR = new Float32Array(LATMAX + 2);
  P.LVT = new Float32Array(LATMAX + 2);
  P.c1 = new Float32Array(NX);
  P.s1 = new Float32Array(NX);
  P.grid = new Float32Array(NX * NY);
  P.R = new Float32Array(W * H);
  P.out = new Uint8Array(W * H * 3);
  // Catmull-Rom taps for the rows between the solved ones.
  P.yj = new Int32Array(H * 4);
  P.yw = new Float32Array(H * 4);
  for (let y = 0; y < H; y++) {
    const v = ((y + 0.5) * NY) / H - 0.5;
    const j = floor(v), t = v - j;
    const t2 = t * t, t3 = t2 * t;
    P.yw.set([0.5 * (-t3 + 2 * t2 - t), 0.5 * (3 * t3 - 5 * t2 + 2), 0.5 * (-3 * t3 + 4 * t2 + t), 0.5 * (t3 - t2)], y * 4);
    for (let n = 0; n < 4; n++) P.yj[y * 4 + n] = cl(j - 1 + n, 0, NY - 1);
  }
  P.fill = new Float32Array(256 * 3);
  P.line = new Float32Array(256 * 3);
  P.hc = -9;
  P.occ = 0.3;
  P.zoom = 0.51;
  P.lit = 0.3;
  palette(P, 0);
  step(P, 0, [0, 2, 1, 0.06], true);
  P.fresh = true;
}

// The ramp from the cheapest transfer (p = 1) to the far field (p = 0): the fill
// of the chart, and a lighter, paler copy for the contour lines.
function palette(P, h0) {
  P.hc = h0;
  const hs = [0.715, 0.6, 0.475, 0.27, 0.15], ps = [0, 0.28, 0.52, 0.78, 1];
  for (let i = 0; i < 256; i++) {
    const p = i / 255;
    let n = 0;
    while (n < 3 && p > ps[n + 1]) n++;
    const u = smooth((p - ps[n]) / (ps[n + 1] - ps[n]));
    const h = h0 + hs[n] + (hs[n + 1] - hs[n]) * u;
    // The dark end is dim indigo; turned to yellow or red it would read as brown, so
    // it is darker the further the hue is from blue.
    const warm = 0.5 - 0.5 * cos(TAU * (h - 0.68));
    const vlow = 0.24 - 0.12 * warm;
    hsv(h, 0.96 - 0.1 * p * p, vlow + (0.88 - vlow) * pow(p, 0.85), P.fill, i * 3);
    hsv(h, 0.45 - 0.2 * p, 0.62 + 0.38 * pow(p, 0.5), P.line, i * 3);
  }
}

function step(P, d, k, init) {
  const t = P.t;
  const kt = cl(k[1], 0, 5), ke = cl(k[2], 1, 8), kc = cl(k[3], -1, 1);
  // The destination wanders: its mean radius moves by a few incommensurate slow
  // sines (each zero at the start), its eccentricity and its perihelion likewise.
  const drift =
    0.26 * (sin(0.0371 * t + 1.3) - sin(1.3)) + 0.17 * (sin(0.0217 * t + 4.1) - sin(4.1)) + 0.09 * (sin(0.0649 * t + 2.2) - sin(2.2));
  const base = 0.7 * pow(5.2 / 0.7, kt / 5);
  // The drift may not carry it onto the orbit of the departure planet, where the
  // two share a year and the islands are 30 years apart; the bound is 1.2 on the
  // far side and 0.85 on the near, and closes to 1 as the knob comes to 1.
  let a = base * exp(drift);
  if (base >= 1) {
    const x = a - (1 + 0.2 * smooth((base - 1) / 0.3));
    a = a - x + 0.5 * (x + sqrt(x * x + 0.0064));
  } else {
    const x = 1 - 0.15 * smooth((1 - base) / 0.25) - a;
    a = a + x - 0.5 * (x + sqrt(x * x + 0.0064));
  }
  const e = cl(0.11 + 0.09 * (sin(0.093 * t + 2) - sin(2)) + 0.05 * (sin(0.0411 * t + 0.5) - sin(0.5)), 0.02, 0.22);
  const w = 0.9 + 0.03 * t + 0.6 * (sin(0.07 * t + 1.1) - sin(1.1));
  const nn = pow(a, -1.5);
  // The epoch runs; the two planets move on by their own rates. The knob sets the
  // pace over an island; across the dark saddle between two islands the epoch runs
  // up to six times as fast, so the next window comes soon.
  P.occ += (P.lit - P.occ) * (1 - exp(-d / 0.6));
  const dE = Math.min(0.45 * pow(ke, 1.1) * (1 + 5 * smooth(1 - P.occ / 0.12)), 6) * d;
  P.th1 = (P.th1 + dE) % TAU;
  P.M2 = (P.M2 + nn * dE) % TAU;

  // The window is about half a synodic period while an island is in view: an island
  // is only a few weeks wide against the 2 years between them, so a whole period
  // would draw it as a sliver. When nothing cheap is in view the chart pulls back to
  // 1.3 periods, which always holds one, and zooms in again as it comes up.
  P.zoom += (0.5 + 0.8 * smooth(1 - P.occ / 0.12) - P.zoom) * (1 - exp(-d / 1.0));
  const WD = cl((TAU * P.zoom) / abs(nn - 1), 3.2, 40);
  // The flight-time axis pans a little, which moves the island up and down.
  const pan = 0.2 * (sin(0.083 * t + 0.9) - sin(0.9)) + 0.1 * (sin(0.0517 * t + 3.3) - sin(3.3));
  const tfl = TF_LO + pan, tfh = TF_HI + pan;
  const tH = PI * pow((1 + a) / 2, 1.5);
  // At the start the cheapest island is put a little right of the middle of the
  // window, whatever the target: the phase at which the destination sits half a turn
  // ahead of the departure planet one Hohmann time later.
  if (init) P.M2 = PI + P.th1 - w - nn * tH - (nn - 1) * 0.12 * WD;
  const tau0 = tfl * tH, dTau = ((tfh - tfl) * tH) / (NY - 1);
  // One ephemeris point every 0.05 time units or so, 200 to 1400 of them.
  const span = WD + (tfh - tfl) * tH, nlat = cl(Math.ceil(span / 0.05), 200, LATMAX);
  const u0 = -WD / 2 + tau0, du = span / nlat;
  ephemeris(P, u0, du, nlat, nn, P.M2, a, e, w);
  const { LX, LY, LVR, LVT, c1, s1, grid } = P;
  for (let i = 0; i < NX; i++) {
    const th = P.th1 + (i / (NX - 1) - 0.5) * WD;
    c1[i] = cos(th);
    s1[i] = sin(th);
  }
  // What is plotted drifts between the launch burn alone (a C3 chart), the sum, and
  // the arrival burn alone: weights 1 + c and 1 - c.
  const bl = 0.85 * (sin(0.043 * t + 0.7) - sin(0.7)) + 0.3 * (sin(0.0191 * t + 3.9) - sin(3.9));
  const wd = 1 + cl(bl, -0.9, 0.9), wa = 1 - cl(bl, -0.9, 0.9);
  const hd = sqrt(pow(hohmann(a, wd, wa), 2) + 0.06 * 0.06);
  const ih = 1 / hd, idu = 1 / du;
  for (let j = 0; j < NY; j++) {
    const tau = tau0 + dTau * j;
    let last = 1;
    for (let i = 0; i < NX; i++) {
      const f = ((i / (NX - 1) - 0.5) * WD + tau - u0) * idu;
      let n = f | 0;
      if (n > nlat - 1) n = nlat - 1;
      const fr = f - n;
      const X2 = LX[n] + (LX[n + 1] - LX[n]) * fr, Y2 = LY[n] + (LY[n + 1] - LY[n]) * fr;
      const vr = LVR[n] + (LVR[n + 1] - LVR[n]) * fr, vt = LVT[n] + (LVT[n + 1] - LVT[n]) * fr;
      const dv = transferCost(c1[i], s1[i], X2, Y2, vr, vt, tau, wd, wa);
      // A solve that fails takes its left-hand neighbour's value, so there is never a hole.
      if (dv >= 0) last = dv * ih < RMAX ? dv * ih : RMAX;
      grid[j * NX + i] = log(last);
    }
  }

  // Contours: rings at a fixed ratio of delta-v to the cheapest transfer, count
  // and spacing from the knob; the ramp window narrows as the rings crowd in.
  const br = exp(0.3 * (sin(0.057 * t + 2.4) - sin(2.4)) + 0.15 * (sin(0.0313 * t + 0.4) - sin(0.4)));
  shade(P, 0.19 * pow(2, -0.95 * kc), (0.5 + 0.35 * pow(2, -1.1 * kc)) * br, log(1.03));
}

// Where a ratio sits on the ramp, 1 at the cheapest transfer, a half at one window
// width above it, and a long tail so the far field keeps some light.
function ramp(dg, wl) {
  if (dg <= 0) return 1;
  const q = dg / wl;
  return 1 / (1 + pow(q, 1.4));
}

// Draw the chart: smooth the rows up to the panel, find each LED's delta-v ratio
// (as a logarithm) and its slope, colour it from the ramp and lay the contour lines
// over it. A line is about 2 LEDs across with soft edges; where rings would crowd
// closer than 2.5 LEDs they fade out so the colour shows instead.
function shade(P, delta, wl, L0) {
  const { grid, R, yj, yw, out, fill, line } = P;
  for (let y = 0; y < H; y++) {
    const a = yj[y * 4] * NX, b = yj[y * 4 + 1] * NX, c = yj[y * 4 + 2] * NX, e = yj[y * 4 + 3] * NX;
    const w0 = yw[y * 4], w1 = yw[y * 4 + 1], w2 = yw[y * 4 + 2], w3 = yw[y * 4 + 3];
    for (let x = 0; x < W; x++) R[y * W + x] = w0 * grid[a + x] + w1 * grid[b + x] + w2 * grid[c + x] + w3 * grid[e + x];
  }
  const R0 = log(0.95), top = log(LTOP), near = log(3);
  const id = 1 / delta;
  let lit = 0;
  for (let y = 0; y < H; y++) {
    const ya = y > 0 ? -W : 0, yb = y < H - 1 ? W : 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = R[i];
      if (r < near) lit++;
      const xa = x > 0 ? -1 : 0, xb = x < W - 1 ? 1 : 0;
      const gx = (R[i + xb] - R[i + xa]) / (xb - xa || 1), gy = (R[i + yb] - R[i + ya]) / ((yb - ya) / W || 1);
      const p = ramp(r - R0, wl);
      const pi = ((p * 255) | 0) * 3;
      let cr = fill[pi], cg = fill[pi + 1], cb = fill[pi + 2];
      const u = (r - L0) * id, kk = floor(u + 0.5), dl = abs(u - kk);
      let al = 0;
      if (kk >= 0 && r < top) {
        const grad = sqrt(gx * gx + gy * gy) * id;
        const ge = grad > 0.14 ? grad : 0.14;
        const dist = dl / ge, sp = 1 / ge;
        const w0 = sp > 3 ? 0.55 : 0.33 + 0.073 * sp;
        al = smooth(1 - (dist - w0) / 0.9);
        if (al > 0) {
          al *= smooth((sp - 1.6) / 1.4) * smooth((top - r) / 0.3);
          if (al > 0) {
            const lv = L0 + kk * delta;
            const pk = ramp(lv - R0, wl);
            const li = ((pk * 255) | 0) * 3;
            cr += (line[li] - cr) * al;
            cg += (line[li + 1] - cg) * al;
            cb += (line[li + 2] - cb) * al;
          }
        }
      }
      const o = i * 3;
      out[o] = cr;
      out[o + 1] = cg;
      out[o + 2] = cb;
    }
  }
  P.lit = lit / (W * H);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 1, 0.06];
  const d = cl(dt, 0, 0.1);
  params.t += d;
  // The ramp itself turns slowly, up to 0.17 of a turn (indigo to violet, yellow to
  // green) and back, on two periods that do not divide.
  const t = params.t;
  const h0 = cl(k[0], 0, 1) + 0.05 * (1 - cos(0.0271 * t)) + 0.035 * (1 - cos(0.0443 * t));
  if (abs(h0 - params.hc) > 1e-4) palette(params, h0);
  const init = params.fresh;
  params.fresh = false;
  step(params, d, k, init);
}

export function draw(display, params) {
  const { out } = params;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
