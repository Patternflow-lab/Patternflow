// ===== Patternflow pattern =====
// Title:   Smale Horseshoe
// Family:  fractal
// Idea:    Smale's horseshoe map squeezes the square in the middle of the panel sideways and stretches it up past the top, then bends it back down over itself, fold after fold; the panel holds the folded ribbon of the fifth image, 32 strands about an LED wide that cross the square gold where the ribbon runs up and azure where it runs down, turning in nested arches above and nested U's below; where they cross the eight horizontal strips of points that stay in the square for three more folds they turn white, the invariant Cantor set on which the map is the shift on two symbols.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Smale's horseshoe (Stephen Smale, 1965)
// Round:   54
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Strands=-1..1, Squeeze=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the rising strands are gold and the falling ones azure, with violet stable strands and white crossings; at 0.5 the rising strands turn blue and the falling ones orange.
// Knob 2: Speed. One fold a cycle. At 2 a cycle takes 3 s and holds still for the first half; the squeeze and stretch take 0.45 s of the rest and the bend 1.05 s. At 0.2 a cycle takes 30 s, at 3 two seconds.
// Knob 3: Strands. Which Cantor family shows. At 0 both: the images of the panel as vertical strands and the points that stay in the square for three more folds as faint violet bands, white where they cross. At -1 only the images. Towards +1 the images fade and the violet bands brighten to full, the stable set alone.
// Knob 4: Squeeze. The factor lambda by which a fold narrows the square, 0.445 at 0 down to 0.285 at 1 (0.435 at the opening), with the stretch mu = 2 + (pi/2)(1 - lambda), 2.89 at the opening. The level drawn keeps the finest strands near an LED wide: the fifth image's 32 strands up to 0.15 and the fourth's 16 up to 0.66; from there on the third's 8, with gaps that widen as lambda falls.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, atan2, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const ss = (t) => t * t * (3 - 2 * t);

// The domain D is the panel: x from 0 to 64, Y from 0 at the bottom row to
// 128. The square Q runs from Y = C to QT; the cap A lies below it and the
// cap B above.
const C = 32, QT = 96, HQ = 64;
// A cycle: held still for HOLD of it, then the homotopy, its first T1 the
// straight squeeze and stretch and the rest the bend.
const HOLD = 0.5, T1 = 0.3;

// f lays D along a U-shaped centre line, squeezed by lambda across it and
// stretched along it by mu through Q. The left leg runs up the left edge of
// Q and the right leg down the right edge; between them the bend of radius R
// turns over in B. A goes to the left foot below Q, shifted sideways only,
// and B to the right foot, turned over. So f(D) lies in D and meets Q in two
// vertical strips, each lambda wide; the horizontal strip of Q between the
// two that feed the legs goes round the bend.
function geom(S, lam) {
  S.lam = lam;
  S.w = 32 * lam;
  S.R = 32 - S.w;
  // The bend runs as fast as the legs: pi R = mu (HQ - 2 HQ / mu).
  S.mu = 2 + (PI * S.R) / HQ;
  S.len = 2 * C + HQ * S.mu;
  // The level drawn: the finest vertical strands near an LED wide, the
  // finest horizontal ones near an LED tall.
  S.nf = cl(floor(log(0.85 / 64) / log(lam)), 2, 6);
  S.nb = cl(floor(log(0.9 / HQ) / log(1 / S.mu)), 2, 6);
}

// From arc length along the centre line back to the height Y in D.
const isig = (S, s) => (s < C ? s : s <= C + HQ * S.mu ? C + (s - C) / S.mu : QT + s - C - HQ * S.mu);

// The preimage under f of a point of f(D), into P. P[2] is 1 when that
// point's piece of the strand runs the other way up from its preimage: the
// right leg and foot, and the half of the bend past the top. False when the
// point is not in f(D).
function finv(S, X, Y, P) {
  const lam = S.lam, w2 = 2 * S.w;
  if (Y <= QT) {
    if (X <= w2) {
      P[0] = X / lam;
      P[1] = Y < C ? Y : C + (Y - C) / S.mu;
      P[2] = 0;
      return true;
    }
    if (X >= 64 - w2) {
      P[0] = (64 - X) / lam;
      P[1] = Y < C ? QT + C - Y : QT - (Y - C) / S.mu;
      P[2] = 1;
      return true;
    }
    return false;
  }
  const dx = X - 32, dy = Y - QT, r = sqrt(dx * dx + dy * dy);
  if (abs(r - S.R) > S.w) return false;
  const th = atan2(dy, dx);
  P[0] = 32 + (S.R - r) / lam;
  P[1] = C + (HQ + S.R * (PI - th)) / S.mu;
  P[2] = th < PI / 2 ? 1 : 0;
  return true;
}

// How many times a point can be pulled back by f and stay in D, up to nf:
// a point of f^d(D) outside f^(d+1)(D). In Q this is the depth of the gap
// of the Cantor set it sits in. The parity of the turns over in the first
// nf - 1 pulls goes to S.o1 and in all nf to S.o2: whether the strand of
// f^nf(D) through the point runs up (0) or down (1). Strands next to each
// other always run opposite ways.
function fdepth(S, X, Y, P) {
  let k = 0, o = 0;
  P[0] = X;
  P[1] = Y;
  S.o1 = 0;
  while (k < S.nf && finv(S, P[0], P[1], P)) {
    o ^= P[2];
    k++;
    if (k === S.nf - 1) S.o1 = o;
  }
  S.o2 = o;
  return k;
}

// How many times f can push a point forward and keep it in Q, up to nb + 1.
// It depends on the height alone: the horizontal strips.
function bdepth(S, Y) {
  let k = 0;
  const mu = S.mu, h = HQ / mu;
  while (k <= S.nb && Y >= C && Y <= QT) {
    k++;
    const q = Y - C;
    if (q < h) Y = C + mu * q;
    else if (q > HQ - h) Y = C + mu * (HQ - q);
    else return k;
  }
  return k;
}

// The homotopy from the identity at tau = 0 to f at tau = 1: the panel
// squeezed toward its left edge and stretched straight up along the centre
// line, then the part above Q bent over, the bend's angle growing to pi.
// phase() fixes the shape for one tau; minv() takes a point back through it
// into P, with P[2] set where the bend has turned the strand downward, and
// is false outside the image.
function phase(S, tau) {
  S.tau = tau;
  if (tau < T1) {
    const a = ss(tau / T1);
    S.sx = 1 - a + a * S.lam;
    S.sq = 1 - a + a * S.mu;
    S.gt = QT * (1 - a) + a * (C + HQ * S.mu);
  } else {
    S.phi = PI * ss((tau - T1) / (1 - T1));
    S.ct = cos(PI - S.phi);
    S.st = sin(PI - S.phi);
  }
}

function minv(S, X, Y, P) {
  P[2] = 0;
  if (S.tau < T1) {
    const x = X / S.sx, y = Y < C ? Y : Y <= S.gt ? C + (Y - C) / S.sq : QT + Y - S.gt;
    if (x > 64 || y > 128) return false;
    P[0] = x;
    P[1] = y;
    return true;
  }
  const phi = S.phi, lam = S.lam, w = S.w, R = S.R;
  let s = -1, u = 0;
  if (Y <= QT) {
    if (X <= 2 * w) (s = Y), (u = (X - w) / lam);
  } else {
    const dx = X - 32, dy = Y - QT, r = sqrt(dx * dx + dy * dy);
    if (abs(r - R) <= w) {
      const th = atan2(dy, dx);
      if (th >= PI - phi) {
        s = QT + R * (PI - th);
        u = (R - r) / lam;
        P[2] = th < PI / 2 ? 1 : 0;
      }
    }
  }
  if (s < 0) {
    // Past the bend the strip runs straight on, along its tangent.
    const ct = S.ct, st = S.st, px = X - 32 - R * ct, py = Y - QT - R * st;
    const sl = px * st - py * ct, off = -px * ct - py * st;
    if (sl >= 0 && abs(off) <= w) {
      s = QT + R * phi + sl;
      u = off / lam;
      P[2] = phi > PI / 2 ? 1 : 0;
    }
  }
  if (s < 0 || s > S.len) return false;
  P[0] = 32 + u;
  P[1] = isig(S, s);
  return true;
}

export function setup(params) {
  // The first second shows the folded ribbon still; the first stretch
  // starts at 1.5 s.
  params.s = { ph: 0.98, hue: 0, strands: 0, lam: 0, nf: 5, nb: 4, tau: 0, sx: 1, sq: 1, gt: QT, phi: 0, ct: -1, st: 0, o1: 0, o2: 0, c: [0, 0, 0], P: [0, 0, 0], pal: new Float64Array(15) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.strands = cl(k[2], -1, 1);
  const lam = 0.445 - 0.16 * cl(k[3], 0, 1);
  if (lam !== S.lam) geom(S, lam);
  S.ph += (d * cl(k[1], 0.2, 3)) / 6;
  S.ph -= floor(S.ph);
}

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  o[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  o[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return o;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const tau = S.ph < HOLD ? 0 : (S.ph - HOLD) / (1 - HOLD);
  phase(S, tau);
  const P = S.P, c = S.c, pal = S.pal, h = S.hue, nf = S.nf, nb = S.nb;
  const wf = min(1, 1 - S.strands), wb = min(1, 1 + S.strands), vb = 0.3 + 0.7 * max(0, S.strands);
  // Rising strands gold and falling strands azure; where a stable strand
  // crosses them, near white. The stable strands alone are violet.
  const cols = [0.12, 0.85, 1, 0.58, 0.75, 0.8, 0.12, 0.12, 1, 0.58, 0.3, 0.9, 0.78, 0.65, vb];
  for (let n = 0; n < 15; n += 3) {
    hsv(h + cols[n], cols[n + 1], cols[n + 2], c);
    pal[n] = c[0];
    pal[n + 1] = c[1];
    pal[n + 2] = c[2];
  }
  for (let j = 0; j < H; j++) {
    const Y = 127.5 - j;
    for (let i = 0; i < W; i++) {
      // The drawn depths move with the ribbon and climb by tau through the
      // fold, so the picture at the end of a cycle is the one it began with:
      // f maps the strands of each level onto those of the next.
      let v = tau - 1, e = 0, dn = 0;
      if (minv(S, i + 0.5, Y, P)) {
        const fl = P[2];
        e = max(0, bdepth(S, P[1]) - tau);
        v = fdepth(S, P[0], P[1], P) + tau;
        // Which way the strand runs, by the turns of the last nf pulls,
        // handing over to the last nf - 1 as the fold adds one more.
        dn = (1 - tau) * (S.o2 ^ fl) + tau * (S.o1 ^ fl);
      } else if (tau > 0.6 && i + 0.5 > 2 * S.w && i + 0.5 < 64 - 2 * S.w) {
        // In the gap the ribbon leaves between its legs, the stable strips
        // of Q come back while the bend closes.
        e = nb - 1 + ((tau - 0.6) / 0.4) * (bdepth(S, Y) - nb + 1);
      }
      const F = wf * cl(v - (nf - 1), 0, 1), B = wb * cl(e - (nb - 1), 0, 1);
      const up = 1 - dn, a = F * (1 - B), b = F * B, g = (1 - F) * B;
      for (let q = 0; q < 3; q++) c[q] = a * (up * pal[q] + dn * pal[3 + q]) + b * (up * pal[6 + q] + dn * pal[9 + q]) + g * pal[12 + q];
      display.setPixel(i, j, min(255, c[0]) | 0, min(255, c[1]) | 0, min(255, c[2]) | 0);
    }
  }
}
