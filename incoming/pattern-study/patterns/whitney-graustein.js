// ===== Patternflow pattern =====
// Title:   Whitney-Graustein
// Family:  topology
// Idea:    A closed curve drawn as a bright line coloured by the direction of its tangent keeps reshaping without ever stopping, so it never leaves its class of turning number, the regions it encloses shaded by their winding number and a dial counting how often the tangent turns, and a change of class has to pass through a cusp: a small loop pulled tight until it vanishes, or a kink born from one.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Whitney-Graustein theorem (Hassler Whitney, On regular closed curves in the plane, 1937, crediting William Caspar Graustein), pattern round 69
// Round:   69
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Turns=-2..3, Wobble=0..1
//
// Knob 1: Hue. Turns the colour wheel the tangent is painted with, and the region shades with it. At 0 a tangent pointing right is azure, regions of winding number 1 and 2 are violet and lilac, and regions of winding -1 are green.
// Knob 2: Speed. At 2 the white marker runs round the curve in 4 s and a change of class takes 5 s, 2.4 of them on the way into and out of the cusp; 0.2 is ten times slower.
// Knob 3: Turns. The turning number k, from -2 to 3, opening on 0, a figure eight. Each step of the knob is one change of class through one cusp, so a jump of three classes passes three.
// Knob 4: Wobble. How far the curve strays from the plain shape of its class: three Fourier terms of the tangent angle, once, twice and three times round, reach 0.38, 0.28 and 0.18 radians at 0 and three times that at 1.
// Buttons: a press moves the curve one class up (down from 3) through a cusp; a second press brings it back.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// ---- The curve. Its tangent angle is theta(t) = th0 + k t + p(t) for t
// round the circle, so the tangent turns k times; p is periodic, three
// Fourier terms whose sizes and phases drift. Its speed r(t) is solved
// below so that the curve closes and never stops, so it stays regular and
// every change of p is a regular homotopy: the class cannot change.
const NS = 600, DT = TAU / NS;
// The plain shape of each class: theta = k t + b sin t. For k = 0 the
// tangent swings 2.405 radians each way, the first zero of the Bessel
// function J0, where the figure eight closes by itself.
const BASE = { "-2": 1.25, "-1": 0.5, 0: 2.405, 1: 0.5, 2: 1.25, 3: 1.6 };
const base = (k) => BASE[k] ?? 1.4;
// Top strip for the dial and the number; the curve lives below it.
const TOP = 21, MARGIN = 3;

function localTurn(S, d) {
  // The kink, after the normal form (u^2, u^3 - s u) of a loop that is
  // pulled tight into a cusp at s = 0 and smoothed away for s < 0. Its
  // tangent turns a full circle when s > 0 and not at all when s < 0. The
  // normal form's tangent only creeps back to straight, as 1/u; past
  // |u| = 1.5 it is eased the rest of the way by |u| = 3, so the kink
  // stays local.
  const u = d / S.w, s = S.s;
  let a = atan2(-2 * u, 3 * u * u - s);
  const far = s > 0 && u > 0 ? TAU : 0;
  if (s > 0 && u > 0) a += TAU;
  const e = smooth((abs(u) - 1.5) / 1.5);
  return a + (far - a) * e;
}

function build(S) {
  const { kb, th0, b1, amp, ph, loop, mu, fade } = S;
  const damp = S.damp;
  // Wrapped Cauchy: (1 + rho) / (1 - rho), for the spread turn.
  const q = (1 + S.rho) / (1 - S.rho);
  const TH = S.TH;
  let e0 = 0, e1 = 0, n = 0;
  if (loop) {
    e0 = localTurn(S, -PI);
    e1 = localTurn(S, PI - 1e-9);
    n = S.s > 0 ? 1 : 0;
  }
  for (let i = 0; i < NS; i++) {
    const t = i * DT;
    let th = th0 + kb * t + b1 * sin(t) + damp * (amp[0] * sin(t + ph[0]) + amp[1] * sin(2 * t + ph[1]) + amp[2] * sin(3 * t + ph[2]));
    if (loop) {
      let d = t - S.t0;
      d -= TAU * floor((d + PI) / TAU);
      // The kink's turn, made exactly periodic.
      let L = fade * (localTurn(S, d) - (e0 + ((e1 - e0 - TAU * n) * (d + PI)) / TAU));
      // The same full turn as a wrapped Cauchy step: as rho falls to 0 it
      // spreads evenly round the curve, where it is the turn of class k+1.
      if (mu > 0) L += mu * (2 * Math.atan(q * Math.tan(d / 2)) + PI - L);
      th += L;
    }
    TH[i] = th;
  }
  // Closure. The speed is r = exp(Re(conj(beta) e^(i theta))), positive
  // for any beta, and beta minimises the convex sum of r over the samples:
  // its gradient is the sum of r e^(i theta), the gap the curve would leave,
  // and the minimum exists because the tangent points every way, or for
  // k = 0 through more than a half turn. A few Newton steps from the last
  // frame's beta find it.
  const CS = S.CS, SN = S.SN;
  for (let i = 0; i < NS; i++) (CS[i] = cos(TH[i])), (SN[i] = sin(TH[i]));
  let bu = S.bu, bv = S.bv;
  for (let it = 0; it < 12; it++) {
    let gx = 0, gy = 0, hxx = 0, hxy = 0, hyy = 0;
    for (let i = 0; i < NS; i++) {
      const c = CS[i], sn = SN[i], e = Math.exp(bu * c + bv * sn);
      gx += e * c;
      gy += e * sn;
      hxx += e * c * c;
      hxy += e * c * sn;
      hyy += e * sn * sn;
    }
    const det = hxx * hyy - hxy * hxy;
    let du = (hyy * gx - hxy * gy) / det, dv = (hxx * gy - hxy * gx) / det;
    const st = sqrt(du * du + dv * dv);
    if (st > 0.5) (du *= 0.5 / st), (dv *= 0.5 / st);
    bu -= du;
    bv -= dv;
    if (st < 1e-7) break;
  }
  // No closed curve has these tangents (a k = 0 curve whose tangent swings
  // less than a half turn): report it and leave the last good curve alone.
  let gx = 0, gy = 0;
  for (let i = 0; i < NS; i++) {
    const e = Math.exp(bu * CS[i] + bv * SN[i]);
    gx += e * CS[i];
    gy += e * SN[i];
  }
  S.ok = Number.isFinite(bu) && Number.isFinite(bv) && abs(gx) + abs(gy) < 1e-3 * NS;
  if (!S.ok) return;
  S.bu = bu;
  S.bv = bv;
  S.beta = sqrt(bu * bu + bv * bv);
  let x = 0, y = 0;
  const X = S.X, Y = S.Y;
  for (let i = 0; i < NS; i++) {
    const r = Math.exp(bu * CS[i] + bv * SN[i]);
    S.HT[i] = TH[i];
    X[i] = x;
    Y[i] = y;
    x += r * CS[i] * DT;
    y += r * SN[i] * DT;
  }
}

export function setup(params) {
  params.s = {
    TH: new Float64Array(NS), HT: new Float64Array(NS), CS: new Float64Array(NS), SN: new Float64Array(NS), bu: 0, bv: 0, X: new Float64Array(NS), Y: new Float64Array(NS),
    PX: new Float32Array(NS), PY: new Float32Array(NS),
    rows: Array.from({ length: H }, () => []),
    wind: new Int8Array(W * H),
    kb: null, th0: 0, b1: 0, amp: [0, 0, 0], ph: [0, 0, 0],
    loop: 0, mu: 0, rho: 0, damp: 1, fade: 0, s: 0, w: 0.4, t0: 0, phase: 0, pt: 0, dir: 0,
    tau: 0, mark: 0, flash: 0, off: 0, hue: 0, wob: 0.3,
    // Each harmonic of p drifts at its own pace.
    rate: [0.11 + 0.05 * Math.random(), 0.17 + 0.05 * Math.random(), 0.23 + 0.05 * Math.random()],
    seed: [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU],
  };
}

// Seconds at Speed 2 for easing the kink in, for the cusp, and for spreading
// the new turn round the curve.
const EASE = 0.6, CUSP = 2.4, SPREAD = 2;
const S_MAX = 2;
// The spread turn starts as wide as the kink: (1 - RHO) / (1 + RHO) = 0.2.
const RHO = 0.667;

export function update(dt, input, params) {
  const S = params.s;
  const k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.05, 3) / 2;
  S.hue = k[0];
  S.wob = 0.5 + 1.0 * cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed.some(Boolean)) S.off = S.off ? 0 : 1;
  const pick = cl(round(k[2]), -2, 3);
  const target = S.off ? (pick < 3 ? pick + 1 : pick - 1) : pick;
  if (S.kb === null) (S.kb = target), (S.b1 = base(target));
  S.tau += dt * sp;
  // The marker goes round the curve once in 4 s at Speed 2.
  S.mark = (S.mark + (dt * sp) / 4) % 1;
  for (let m = 0; m < 3; m++) {
    S.amp[m] = S.wob * [0.75, 0.55, 0.35][m] * sin(S.rate[m] * TAU * S.tau * 0.5 + S.seed[m]);
    S.ph[m] = S.seed[m] * 2 + S.tau * S.rate[m] * 1.3;
  }
  S.th0 += dt * sp * 0.05;

  // Class changes, one step at a time.
  if (!S.phase && target !== S.kb) {
    S.dir = target > S.kb ? 1 : -1;
    S.phase = 1;
    S.pt = 0;
    S.loop = 0;
    build(S);
    // The kink sits where the curve is farthest from its middle.
    let cx = 0, cy = 0, best = -1;
    for (let i = 0; i < NS; i++) (cx += S.X[i]), (cy += S.Y[i]);
    cx /= NS;
    cy /= NS;
    for (let i = 0; i < NS; i += 3) {
      const d = (S.X[i] - cx) ** 2 + (S.Y[i] - cy) ** 2;
      if (d > best) (best = d), (S.t0 = i * DT);
    }
    // Next to class 0 the kink goes at t = 0, where the turn adds to the
    // swing b1 sin t instead of cancelling it: a k = 0 curve needs its
    // tangent to swing more than a half turn, or nothing closes it.
    const lo = S.dir > 0 ? S.kb : S.kb - 1;
    if (lo === 0 || lo === -1) S.t0 = 0;
    S.loop = 1;
    if (S.dir > 0) (S.fade = 0), (S.s = -S_MAX), (S.mu = 0), (S.rho = RHO);
    else {
      // Write the class-k curve as a class k-1 curve plus a full turn
      // spread evenly round it, then gather that turn into a loop.
      S.kb -= 1;
      S.th0 -= PI - S.t0;
      S.fade = 1;
      S.s = S_MAX;
      S.mu = 1;
      S.rho = 0;
    }
  }
  if (S.phase) {
    S.pt += dt * sp;
    // s runs from -S_MAX to S_MAX, slowest at the cusp so it can be seen.
    const g = (u) => {
      const v = 2 * cl(u, 0, 1) - 1;
      return S_MAX * v * (0.2 + 0.8 * v * v);
    };
    const kLo = S.kb, kHi = S.kb + 1;
    // Up runs the steps forward; down runs the same steps backward.
    const p = S.dir > 0 ? S.pt : EASE + CUSP + SPREAD - S.pt;
    // A bump grows, sharpens into a cusp, and a kink is born from it; the
    // kink's full turn takes a wrapped Cauchy profile and spreads round the
    // curve.
    S.fade = cl(p / EASE, 0, 1);
    S.s = g((p - EASE) / CUSP);
    const v = cl((p - EASE - CUSP) / SPREAD, 0, 1);
    S.mu = smooth(v / 0.3);
    const spread = smooth((v - 0.3) / 0.7);
    S.rho = RHO * (1 - spread);
    S.b1 = base(kLo) + (base(kHi) - base(kLo)) * spread;
    if (abs(S.s) < 0.1 && S.fade > 0.99 && !S.mu) S.flash = 1;
    if (S.pt >= EASE + CUSP + SPREAD) {
      if (S.dir > 0) (S.kb += 1), (S.th0 += PI - S.t0);
      S.loop = 0;
      S.phase = 0;
      S.mu = 0;
      S.b1 = base(S.kb);
    }
  }
  S.flash = max(0, S.flash - dt * 1.5);
  // Where the wobble would push |beta| past 1.2, so that one stretch of the
  // curve runs 11 times faster than another, or leaves nothing that closes,
  // the wobble is turned down, and it comes back slowly.
  S.damp = min(1, S.damp + dt * 0.3);
  build(S);
  for (let n = 0; n < 12 && (!S.ok || S.beta > 1.2); n++) {
    S.damp *= 0.8;
    build(S);
  }
}

// 3 by 5 digits and a minus.
const DIGITS = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001"];

export function draw(display, params) {
  const S = params.s;
  if (!S.X || S.kb === null) return;
  const { X, Y, HT: TH, PX, PY, rows, wind } = S;
  // Fit the curve under the strip, a little taller than it is if there is room.
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < NS; i++) (x0 = min(x0, X[i])), (x1 = max(x1, X[i])), (y0 = min(y0, Y[i])), (y1 = max(y1, Y[i]));
  const aw = W - 2 * MARGIN, ah = H - TOP - 2 * MARGIN;
  const fx = aw / max(1e-6, x1 - x0), fy = ah / max(1e-6, y1 - y0);
  const sx = min(fx, fy), sy = min(fy, sx * 1.8);
  const cx = W / 2, cy = TOP + MARGIN + ah / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (let i = 0; i < NS; i++) {
    PX[i] = cx + (X[i] - mx) * sx;
    PY[i] = cy - (Y[i] - my) * sy;
  }

  // Winding numbers, row by row: each edge crossing the row's middle adds
  // +1 going down the panel and -1 going up, counted from the left.
  for (let y = 0; y < H; y++) rows[y].length = 0;
  for (let i = 0; i < NS; i++) {
    const j = (i + 1) % NS, ax = PX[i], ay = PY[i], bx = PX[j], by = PY[j];
    if (ay === by) continue;
    const dir = by > ay ? 1 : -1, lo = min(ay, by), hi = max(ay, by);
    for (let y = Math.ceil(lo - 0.5); y + 0.5 < hi && y < H; y++) {
      if (y < 0 || y + 0.5 < lo) continue;
      rows[y].push(ax + ((y + 0.5 - ay) * (bx - ax)) / (by - ay), dir);
    }
  }
  wind.fill(0);
  for (let y = 0; y < H; y++) {
    const r = rows[y];
    if (!r.length) continue;
    const idx = [];
    for (let q = 0; q < r.length; q += 2) idx.push(q);
    idx.sort((a, b) => r[a] - r[b]);
    let w = 0, q = 0;
    for (let x = 0; x < W; x++) {
      while (q < idx.length && r[idx[q]] < x + 0.5) (w += r[idx[q] + 1]), q++;
      wind[y * W + x] = w;
    }
  }
  const hue0 = S.hue + 0.58;
  const shade = (w) => {
    if (!w) return null;
    const a = min(3, abs(w));
    return hsv(hue0 + (w > 0 ? 0.1 : -0.12) + 0.05 * a * Math.sign(w), 0.5, 0.16 + 0.12 * a);
  };
  const shades = {};
  for (let w = -4; w <= 4; w++) shades[w] = shade(w);
  for (let y = TOP; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = shades[cl(wind[y * W + x], -4, 4)];
      if (c) display.setPixel(x, y, c[0] * 255, c[1] * 255, c[2] * 255);
    }

  // The line, coloured by the direction it is drawn in.
  const dirHue = (th) => atan2(sy * sin(th), sx * cos(th)) / TAU;
  for (let i = 0; i < NS; i++) {
    const j = (i + 1) % NS, ax = PX[i], ay = PY[i], bx = PX[j], by = PY[j];
    const c = hsv(hue0 + dirHue(TH[i]), 0.8, 1);
    const steps = max(1, Math.ceil(2 * max(abs(bx - ax), abs(by - ay))));
    for (let q = 0; q < steps; q++) {
      const u = q / steps;
      display.setPixel(ax + (bx - ax) * u, ay + (by - ay) * u, c[0] * 255, c[1] * 255, c[2] * 255);
    }
  }

  // The marker on the curve, and the dial: the colour wheel with a dot at
  // the marker's tangent direction, which goes round k times while the
  // marker goes round once.
  const mi = floor(S.mark * NS) % NS, mth = TH[mi];
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) display.setPixel(PX[mi] + dx, PY[mi] + dy, 255, 255, 255);
  const DX = 11, DY = 10, DR = 7.5;
  for (let y = 1; y < 20; y++)
    for (let x = 2; x < 21; x++) {
      const dx = x + 0.5 - DX, dy = y + 0.5 - DY, d = sqrt(dx * dx + dy * dy);
      if (abs(d - DR) < 0.75) {
        const c = hsv(hue0 + atan2(-dy, dx) / TAU, 0.8, 0.55);
        display.setPixel(x, y, c[0] * 255, c[1] * 255, c[2] * 255);
      }
    }
  const ma = atan2(sy * sin(mth), sx * cos(mth));
  const ddx = DX + DR * cos(ma), ddy = DY - DR * sin(ma);
  for (let y = floor(ddy - 2); y <= ddy + 2; y++)
    for (let x = floor(ddx - 2); x <= ddx + 2; x++) {
      const d = sqrt((x + 0.5 - ddx) ** 2 + (y + 0.5 - ddy) ** 2);
      if (d < 1.7) display.setPixel(x, y, 255, 255, 255);
    }
  for (let y = floor(DY - 1); y <= DY; y++) for (let x = floor(DX - 1); x <= DX; x++) display.setPixel(x, y, 120, 120, 120);

  // The turning number, doubled 3 by 5 digits.
  const k = S.kb + (S.loop && (S.s > 0 || S.mu > 0) ? 1 : 0);
  const lv = 150 + 105 * S.flash;
  const dg = DIGITS[abs(k)] || DIGITS[0];
  const ox = 40, oy = 5;
  for (let b = 0; b < 15; b++)
    if (dg[b] === "1")
      for (let e = 0; e < 4; e++) display.setPixel(ox + 2 * (b % 3) + (e & 1), oy + 2 * floor(b / 3) + (e >> 1), lv, lv, lv);
  if (k < 0) for (let x = 31; x < 37; x++) for (let e = 0; e < 2; e++) display.setPixel(x, 9 + e, lv, lv, lv);

  // The cusp flashes white, with a ring opening round it.
  if (S.loop && S.flash > 0) {
    const ci = floor(((S.t0 / TAU) % 1) * NS), px = PX[ci], py = PY[ci], rad = 2 + 7 * (1 - S.flash);
    for (let y = floor(py - rad - 2); y <= py + rad + 2; y++)
      for (let x = floor(px - rad - 2); x <= px + rad + 2; x++) {
        const d = sqrt((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2);
        const v = 255 * S.flash;
        if (abs(d - rad) < 0.7 || d < 1.5) display.setPixel(x, y, v, v, v);
      }
  }
}
