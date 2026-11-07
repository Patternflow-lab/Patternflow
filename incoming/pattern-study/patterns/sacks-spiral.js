// ===== Patternflow pattern =====
// Title:   Sacks Spiral
// Family:  number
// Idea:    A view onto the Sacks spiral, the integer n put at radius sqrt n and angle 2 pi a sqrt n, shows each prime as a gold bead and each composite as a dim bead coloured by its smallest prime factor, and rides out along Euler's arm n = t^2 + t + 41, a bright curved string whose first forty beads are all prime and whose next 560 are prime six times in ten, while the winding a is turned off 1 so the dotted arms lean, bend and slide sideways.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Sacks spiral (Robert Sacks, 1994), the integers on an Archimedean spiral at radius sqrt n, and Euler's prime-rich polynomial n^2 + n + 41 (Leonhard Euler, 1772), pattern round 105
// Round:   105
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Flow=0.2..3, Winding=0..4, Zoom=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a composite is blue when its smallest factor is 2, teal for 3, violet for 5, magenta for 7, sea green for 11 and slate for the rest, a prime is gold and the composites on Euler's arm are pale cyan.
// Knob 2: Flow. How fast the view rides out along the arm, and how fast the winding swells. At 2 its radius grows 0.63 units a second at radius 70, 0.99 at 150 and 1.5 at 300. It reaches radius 300 after 220 s and turns there. It is back at radius 36 after about 510 s. The winding swells once in 70 s. 0.2 is ten times slower, 3 half as fast again.
// Knob 3: Winding. The winding a = 1 + w / (2 pi r), with w the knob and r the radius of the middle of the view. At 0 a is 1, the plain Sacks spiral, and the arm leans 128 / r LEDs sideways per LED up, to the left; each unit of w leans it one LED further to the right, and the dotted arms bend with it. On top of the knob w swells by 1.5 and back every 70 s at Flow 2, starting a quarter of the way up, so the arms unwind by themselves.
// Knob 4: Zoom. LEDs to the spiral's unit, from 1.25 at 0 to 2.4 at 1: the view is 51 by 102 units at 0 and 27 by 54 at 1, and the beads grow with it, until at 1 each prime is a soft gold dot about four LEDs across.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, round, sqrt, sin, cos, asin, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// Every n up to NMAX is sieved once in setup: 0 is a prime, 1 to 6 a
// composite whose smallest prime factor is 2, 3, 5, 7, 11 or something
// larger, 255 is 0 or 1. The view never reaches past a radius of 360.
const NMAX = 1 << 18;
const SPF = [0, 2, 3, 5, 7, 11, 13];
// Euler's arm is the integers n = t^2 + t + EC. (2t + 1)^2 = 4n - (4 EC - 1)
// tells which n are on it, and t(r) = (-1 + sqrt(4 r^2 - (4 EC - 1))) / 2 is
// the t that has radius r.
const EC = 41, EQ = 4 * EC - 1, RUN = 40;
const tOf = (r) => (-1 + sqrt(max(0, 4 * r * r - EQ))) / 2;
// The view's radius runs between RLO and RHI and turns round at each end, at
// V0 units a second when it is 40 out (Flow 2). The winding w swells by SWELL
// every LAP seconds.
const RLO = 36, RHI = 300, V0 = 0.45;
const SWELL = 1.5, LAP = 70;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const cls = new Uint8Array(NMAX + 1);
  cls[0] = cls[1] = 255;
  for (let p = 2; p * p <= NMAX; p++) {
    if (cls[p] !== 0) continue;
    const i = SPF.indexOf(p), c = i < 1 ? 6 : i;
    for (let n = p * p; n <= NMAX; n += p) if (cls[n] === 0) cls[n] = c;
  }
  params.s = {
    cls,
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N), P: new Float32Array(N), L: new Float32Array(N), A: new Float32Array(N), T: new Float32Array(N), F: new Float32Array(N),
    pal: new Float32Array(30), palHue: -1,
    hue: 0, flow: 2, wk: 0, w: 0, zk: 0,
    // The swell starts a quarter of the way up, so the arms already lean.
    u: LAP / 4,
    r0: 70, dir: 1, sp: 1, s: 1.3,
  };
}

// Composites by smallest prime factor in a cool band, primes in gold. A dim
// orange reads as brown on the panel, so a hue that would land in red to
// yellow goes to crimson, and one in yellow to green goes to green.
// Slots: 0 gold, 3 to 18 the six composites, 21 the arm's composites, 24 the
// white-gold of the arm's first forty beads.
function palette(S) {
  const t = S.pal, off = [0, 0.62, 0.5, 0.75, 0.87, 0.4, 0.58];
  for (let c = 1; c <= 6; c++) {
    let h = S.hue + off[c];
    h -= floor(h);
    h = h < 0.17 ? 0.94 + h * 0.3 : h < 0.33 ? 0.33 : h;
    hsv(h, c === 6 ? 0.4 : 0.85, c === 1 ? 0.56 : 0.46, t, c * 3);
  }
  hsv(S.hue + 0.12, 0.5, 1, t, 0);
  hsv(S.hue + 0.55, 0.3, 1, t, 21);
  hsv(S.hue + 0.12, 0.14, 1, t, 24);
  S.palHue = S.hue;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.flow = cl(k[1], 0.2, 3);
  S.wk = cl(k[2], 0, 4);
  S.zk = cl(k[3], 0, 1);
  S.s = 1.25 * 1.9 ** S.zk;
  // The winding swells from the knob's value up by SWELL and back every LAP
  // seconds at Flow 2, so the arms lean over, bend and slide without a hand.
  S.u += d * (S.flow / 2);
  S.w = S.wk + SWELL * (1 - cos((TAU * S.u) / LAP)) / 2;
  // The view moves out along the arm and back, a little faster the further
  // out it is, and eases through the turns.
  if (S.r0 >= RHI) S.dir = -1;
  else if (S.r0 <= RLO) S.dir = 1;
  S.sp += (S.dir - S.sp) * min(1, d / 3);
  S.r0 += S.sp * V0 * (S.r0 / 40) ** 0.6 * (S.flow / 2) * d;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.palHue !== S.hue) palette(S);
  const { cls, R, G, B, P, L, A, T, F, pal } = S, r0 = S.r0, s = S.s, w = S.w;
  // The winding is a = 1 + w / (2 pi r0). The view is turned on the spiral so
  // that Euler's arm goes through its middle: the arm's angle at radius r is
  // 2 pi (a r - t(r)), and the view is turned by that at r0, plus w. With w
  // = 0 it is the plain Sacks spiral, and the arm leans w - 128 / r0 LEDs
  // sideways for each LED up (pi (4 EC - 1) / 4 is 128 to the unit).
  const a = 1 + w / (TAU * r0), thc = w + TAU * (r0 - tOf(r0));
  // The view is Dt units either side of the middle and Dr either side up and
  // down, with 3 over for the beads' radius. Only the integers whose radius
  // is between rlo and rhi and whose angle is within Dl of the view's can be
  // in it, found a turn at a time: turn kk holds the radii that put the angle
  // within Dl of the view's, once the winding has added 2 pi kk.
  const Dr = 64 / s + 3, Dt = 32 / s + 3, rlo = max(1, r0 - Dr), rhi = sqrt((r0 + Dr) * (r0 + Dr) + Dt * Dt);
  const Dl = Dt >= rlo ? PI : min(PI, asin(Dt / rlo) + 0.3);
  R.fill(0);
  G.fill(0);
  B.fill(0);
  P.fill(0);
  L.fill(0);
  A.fill(0);
  T.fill(0);
  F.fill(0);
  const rb = cl(0.55 * s, 0.7, 1.2), rp = cl(1.15 * s, 1.4, 2.4);
  // A soft disc of radius rad round (fx, fy), each LED handed its weight.
  // A composite is a disc in its colour; a prime on the arm is a bigger one.
  const disc = (fx, fy, rad, fn) => {
    const x0 = max(0, floor(fx - rad - 0.5)), x1 = min(W - 1, ceil(fx + rad - 0.5));
    const y0 = max(0, floor(fy - rad - 0.5)), y1 = min(H - 1, ceil(fy + rad - 0.5));
    for (let iy = y0; iy <= y1; iy++)
      for (let ix = x0; ix <= x1; ix++) {
        const dx = ix + 0.5 - fx, dy = iy + 0.5 - fy, dd = sqrt(dx * dx + dy * dy);
        if (dd < rad) fn(iy * W + ix, 1 - dd / rad);
      }
  };
  const kmin = ceil((TAU * a * rlo - thc - Dl) / TAU), kmax = floor((TAU * a * rhi - thc + Dl) / TAU);
  for (let kk = kmin; kk <= kmax; kk++) {
    const r1 = max(rlo, (thc + TAU * kk - Dl) / (TAU * a)), r2 = min(rhi, (thc + TAU * kk + Dl) / (TAU * a));
    if (r2 < r1) continue;
    const n2 = min(NMAX, Dl >= PI ? ceil(r2 * r2) - 1 : floor(r2 * r2));
    for (let n = ceil(r1 * r1); n <= n2; n++) {
      const c = cls[n];
      if (c === 255) continue;
      const r = sqrt(n), phi = TAU * a * r - thc - TAU * kk;
      const fx = 32 + s * r * sin(phi), fy = 64 - s * (r * cos(phi) - r0);
      const q4 = 4 * n - EQ, sq = round(sqrt(max(0, q4))), arm = q4 > 0 && sq * sq === q4 && (sq & 1) === 1;
      if (c === 0)
        disc(fx, fy, arm ? rp * 1.15 : rp, (q, wg) => {
          const v = sm(wg);
          if (arm) {
            if (v > A[q]) A[q] = v;
            if (sq < 2 * RUN + 1 && v > F[q]) F[q] = v;
          } else if (v > P[q]) P[q] = v;
        });
      else if (arm)
        disc(fx, fy, rb * 1.3, (q, wg) => {
          const v = min(1, wg * 1.6);
          if (v > L[q]) L[q] = v;
        });
      else {
        const o = c * 3;
        disc(fx, fy, rb, (q, wg) => {
          const v = min(1, wg * 1.6);
          if (pal[o] * v > R[q]) R[q] = pal[o] * v;
          if (pal[o + 1] * v > G[q]) G[q] = pal[o + 1] * v;
          if (pal[o + 2] * v > B[q]) B[q] = pal[o + 2] * v;
        });
      }
    }
  }
  // The arm as a curve: its beads at whole t joined by the same formula run
  // on real t, r = sqrt(t^2 + t + EC) and angle 2 pi (a r - t).
  const tl = rlo <= 6.45 ? 0 : tOf(rlo), th = tOf(rhi), lr = cl(0.5 * s, 0.9, 1.3);
  for (let t = tl; t <= th; t += 0.05) {
    const r = sqrt(t * t + t + EC);
    let phi = TAU * (a * r - t) - thc;
    phi -= TAU * round(phi / TAU);
    disc(32 + s * r * sin(phi), 64 - s * (r * cos(phi) - r0), lr, (q, wg) => {
      if (wg * 0.5 > T[q]) T[q] = wg * 0.5;
    });
  }
  const g0 = pal[0], g1 = pal[1], g2 = pal[2], c0 = pal[21], c1 = pal[22], c2 = pal[23];
  for (let q = 0; q < N; q++) {
    let r = R[q], g = G[q], b = B[q];
    const tv = T[q];
    if (tv > 0) {
      r = max(r, g0 * tv * 0.55);
      g = max(g, g1 * tv * 0.55);
      b = max(b, g2 * tv * 0.3);
    }
    const l = L[q], p = P[q] * 0.8, aa = A[q];
    if (l > 0) {
      r += (c0 - r) * l;
      g += (c1 - g) * l;
      b += (c2 - b) * l;
    }
    if (p > 0) {
      r += (g0 * 0.9 - r) * p;
      g += (g1 * 0.9 - g) * p;
      b += (g2 * 0.9 - b) * p;
    }
    if (aa > 0) {
      r += (g0 - r) * aa;
      g += (g1 - g) * aa;
      b += (g2 - b) * aa;
      const f = F[q] * 0.8;
      if (f > 0) {
        r += (pal[24] - r) * f;
        g += (pal[25] - g) * f;
        b += (pal[26] - b) * f;
      }
    }
    display.setPixel(q % W, (q / W) | 0, min(255, r * 255), min(255, g * 255), min(255, b * 255));
  }
}
