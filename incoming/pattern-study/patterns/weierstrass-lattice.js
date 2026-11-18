// ===== Patternflow pattern =====
// Title:   Weierstrass Lattice
// Family:  topology
// Idea:    The Weierstrass function p(z) = 1/z^2 + the sum over lattice points w of 1/(z-w)^2 - 1/w^2 is painted as a domain colouring, hue for its argument and light for its size in contour bands, while the sum is built ring by ring outward from a single pole to the doubly periodic lattice, a thin white ring marking how far the points have been taken in, as the lattice itself walks round the modular fundamental domain from hexagonal to long to square.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Weierstrass elliptic function (Karl Weierstrass, c. 1862), a sum over the lattice points of the Eisenstein kind (Gotthold Eisenstein, 1847), drawn by domain colouring; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.5..4, Shape=0..1, Zoom=1..3
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 a value of p that is real and positive is azure, +i is magenta, real and negative is orange and -i is green, and the black spots are the zeros of p, two to a cell.
// Knob 2: Speed. How fast the sum is built, and rewound. At 2 a run takes 8 s: the lattice points go in from the nearest outward over 5.2 s, the finished lattice holds 1.6 s, and the sum is taken out again over 1.2 s. At 0.5 a run is four times as long and at 4 half as long.
// Knob 3: Shape. Where the lattice stands on its walk round the modular fundamental domain, a whole loop over the knob. The walk itself goes on at 0.015 of the loop a second, so at 0 the lattice starts hexagonal and has gone 0.12 of the way round by 8 s. A quarter of the way it is a long rectangle, half way hexagonal again, and at three quarters it is square. The cells keep one area whatever the shape.
// Knob 4: Zoom. How many lattice cells fit across the panel: 4 at 1 and one and a third at 3, where one pinwheel almost fills the width.

const W = 64, H = 128, NP = W * H;
const { floor, min, max, abs, sqrt, exp, log, cos, sin, atan2, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The lattice has cells of area 1, so a radius is counted in cell widths.
// The sum is taken out to RMAX, over the pairs +w and -w at once.
const PERIOD = 8; // seconds for one run at speed 2
const BUILD = 5.2, HOLD = 6.8; // the sum is built until 5.2 s, holds until 6.8 s and is taken out again by 8 s
const RMAX = 5.95; // the radius the front reaches: on the hexagonal lattice 54 pairs (108 lattice points) are in whole and 6 more part way
const EDGE = 0.35; // a pair goes from out to in as the front crosses this much radius
const MAXP = 160;

const PX = new Float64Array(MAXP), PY = new Float64Array(MAXP), PW = new Float64Array(MAXP);

export function setup(params) {
  // The run starts 2 s before its beginning, so that the sum is empty at 2 s.
  params.s = { u: 1 - 2 / PERIOD, t: 0, hue: 0, shape: 0, zoom: 1, buf: new Uint8Array(NP * 3) };
}

// The lattice's place on its loop, th from 0 to 1, as tau = a + i b inside the
// modular fundamental domain |a| <= 1/2, |tau| >= 1. It starts hexagonal
// (a = 1/2, b = sqrt(3)/2), climbs to a long rectangle (a = 0, b = 1.7), comes
// back to the hexagon and goes home along the arc |tau| = 1 through the
// square (a = 0, b = 1).
function tauAt(th) {
  th = fr(th);
  const a = 0.5 * cos(2 * PI * th), e = th < 0.5 ? 0.7 * sin(2 * PI * th) * sin(2 * PI * th) : 0;
  return [a, sqrt(1 - a * a) + e];
}

// The radius of the front, from the cycle's time in seconds at speed 2. The
// number of lattice points taken in goes as the radius squared, so the radius
// goes as a power of the time a little under a half.
function front(c) {
  if (c < BUILD) return RMAX * Math.pow(c / BUILD, 0.6);
  if (c < HOLD) return RMAX;
  return RMAX * Math.sqrt(1 - sm((c - HOLD) / (PERIOD - HOLD)));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 1], d = cl(dt || 0, 0, 0.1);
  S.t += d;
  S.u = fr(S.u + (d * cl(k[1], 0.5, 4)) / 2 / PERIOD);
  S.hue = cl(k[0], 0, 1);
  S.shape = cl(k[2], 0, 1);
  S.zoom = cl(k[3], 1, 3);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, [ta, tb] = tauAt(S.t * 0.015 + S.shape), L = 1 / sqrt(tb), R = front(S.u * PERIOD);

  // The pairs +w and -w whose weight is above 0: w is 1 well inside the front, 0 well outside it.
  let np = 0, cx = 0, cy = 0;
  for (let m = 0; m <= 14; m++)
    for (let n = -14; n <= 14; n++) {
      if (m === 0 && n <= 0) continue;
      const wx = L * (m + n * ta), wy = L * n * tb, rho2 = wx * wx + wy * wy, g = sm((R - sqrt(rho2)) / EDGE + 0.5);
      if (g <= 0 || np >= MAXP) continue;
      PX[np] = wx; PY[np] = wy; PW[np] = g;
      // Each pair takes 2/w^2 off the sum, so the sum comes to a finite value.
      const r4 = rho2 * rho2;
      cx += (2 * g * (wx * wx - wy * wy)) / r4;
      cy -= (4 * g * wx * wy) / r4;
      np++;
    }

  const sc = 4 / S.zoom / W, hb = S.hue + 0.58, rgb = [0, 0, 0];
  for (let y = 0; y < H; y++) {
    const zy = (y - 63.5) * sc;
    for (let x = 0; x < W; x++) {
      const zx = (x - 31.5) * sc, q = zx * zx + zy * zy, qq = q * q;
      // p(z) = 1/z^2 + the sum over the pairs of 1/(z-w)^2 + 1/(z+w)^2 - 2/w^2.
      let re = (zx * zx - zy * zy) / qq - cx, im = (-2 * zx * zy) / qq - cy;
      for (let p = 0; p < np; p++) {
        const g = PW[p], wx = PX[p], wy = PY[p];
        let dx = zx - wx, dy = zy - wy, n2 = dx * dx + dy * dy, inv = g / (n2 * n2);
        re += (dx * dx - dy * dy) * inv;
        im -= 2 * dx * dy * inv;
        dx = zx + wx; dy = zy + wy; n2 = dx * dx + dy * dy; inv = g / (n2 * n2);
        re += (dx * dx - dy * dy) * inv;
        im -= 2 * dx * dy * inv;
      }
      // Domain colouring: hue is the argument of p; light is |p|, dark where it is small
      // and in a band for each doubling of it, rising through the band and dropping at its end.
      const m2 = re * re + im * im, env = sm((sqrt(m2) - 0.5) / 3.5);
      const f = fr(0.5 * log(m2 + 1e-12) / 0.69315), band = min(1, f / 0.85, (1 - f) / 0.15);
      let v = env * (0.45 + 0.55 * band), sat = 0.9;
      // Orange and yellow go brown when they are dim, so they are made lighter and paler.
      const h = fr(hb + atan2(im, re) / (2 * PI)), o2 = sm(h / 0.04) * (1 - sm((h - 0.16) / 0.06));
      v += o2 * (0.5 * v * (1 - v) + 0.25 * env);
      sat *= 1 - 0.3 * o2;
      hsv(h, sat, min(1, v) * 0.84, rgb);
      // The front of the sum, a thin white ring where the points are half in.
      const ring = R > 0.05 ? max(0, 1 - abs(sqrt(q) - R) / sc) * 0.6 : 0;
      if (ring > 0) {
        rgb[0] += (1 - rgb[0]) * ring;
        rgb[1] += (1 - rgb[1]) * ring;
        rgb[2] += (1 - rgb[2]) * ring;
      }
      const o = (y * W + x) * 3;
      buf[o] = rgb[0] * 255;
      buf[o + 1] = rgb[1] * 255;
      buf[o + 2] = rgb[2] * 255;
    }
  }
  for (let p = 0; p < NP; p++) display.setPixel(p & 63, p >> 6, buf[p * 3], buf[p * 3 + 1], buf[p * 3 + 2]);
}
