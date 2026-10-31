// ===== Patternflow pattern =====
// Title:   Head Wave
// Family:  physics
// Idea:    A cross-section of two-layer ground stands the height of the panel, a slow crust over a mantle 1.35 times faster with a flat boundary across row 64, and a source just above the boundary at the left edge sends out pulses whose first arrivals, worked out exactly by Fermat's principle, run as banded fronts: circles in the crust, wider circles bent through the boundary in the mantle, and beside them a straight conical front in the mantle's colour that the boundary leaks back up into the crust at the critical angle of 47.8 degrees, arriving first over a wedge that reaches 33 rows up at the right edge.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: head waves and the crust-mantle boundary found from them (Andrija Mohorovicic, 1909); first arrivals by Fermat's principle (Pierre de Fermat, 1662), pattern round 81
// Round:   81
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ratio=1.35..2.5, Height=2..50
//
// Knob 1: Hue. Turns both layers round the wheel together. At 0 the crust and every front that stayed in it are sea green and the mantle with the head wave it sends up is rose; at 0.5 the crust is red and the mantle green.
// Knob 2: Speed. How many bands leave the source a second: half the knob, so one a second at the opening 2, a front crossing the crust at 4.4 LEDs a second and the mantle at 1.35 times that; 0.1 a second at 0.2 and 1.5 at 3.
// Knob 3: Ratio. The mantle's speed over the crust's, from 1.35, about the ratio between crust and upper mantle, to 2.5. The critical angle asin(1/ratio) falls from 47.8 to 23.6 degrees, so the conical front tips from a diagonal towards flat, the wedge where it leads grows from 11% of the panel to 25% and reaches the top row at the right edge, and the mantle's bands widen from 5.9 to 11 LEDs.
// Knob 4: Height. How far above the boundary the source sits, 2 to 50 LEDs. At the opening 2 the head wave leads from 2.2 LEDs out along the boundary and its wedge reaches 33 rows up at the right edge; at 20 it leads only from 22 LEDs out and reaches 6 rows up; at 50 it meets the boundary 55 LEDs out and hardly shows.
// Buttons: Any tap moves the source 16 LEDs to the right, from the left edge through 16, 32 and 48 to the right edge and back.

// Everything is measured in LEDs, and time in LEDs of travel through the
// slow layer, so the crust's speed is 1 and the mantle's is r. A pulse
// reaches each point first along the path of least time (Fermat), and there
// are three candidates.
//
// Direct: the straight line from the source, T = distance. Its fronts are
// circles.
//
// Refracted, for points below the boundary: down to some point m on the
// boundary, then on to the point at speed r. T(m) = |s - m| + |m - p| / r is
// convex in m, so a few Newton steps find the minimum, and setting its
// derivative to zero is Snell's law, sin(i) = sin(t) / r.
//
// Head wave, for points above the boundary: down to the boundary at the
// critical angle ic = asin(1/r), along the boundary at speed r, and back up
// at ic. With hs the source's height and hr the point's height above the
// boundary and dx the distance across,
//
//   T = dx / r + (hs + hr) cos(ic),
//
// which is a plane: the conical front. It exists once dx is at least
// (hs + hr) tan(ic), and it arrives first wherever it beats the circle.
// Mohorovicic read exactly this from the Kupa valley earthquake of
// 8 October 1909: beyond some distance a faster phase overtook the direct
// one, and the distance gave him the depth of a faster layer underneath.
//
// The travel time is worked out once whenever the source, the ratio or the
// height change. Each frame only reads it: an LED's light is a sawtooth of
// (t - T) over one period, bright as a front arrives and fading until the
// next, and the source never stops, so every LED is always somewhere in a
// band.
//
// A band climbs to its crest over its width. When its front runs along a
// row or a column the whole climb falls between neighbours in one
// direction; when it runs diagonally the climb splits between the row and
// the column. So each LED's band is drawn as tall as it can be with no step
// between neighbours above 39.5 levels: diagonal fronts, the head wave among
// them, stand at full height and fronts square to the panel at about two
// thirds of it. The drop at the back of each band is the only hard step.

const W = 64, H = 128, N = W * H;
const { floor, min, max, round, sqrt, abs } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The boundary's row, the band width in the crust (LEDs), the largest step
// between two neighbouring LEDs a band may climb, and its full height.
const YB = 64, P = 4.4, CAP = 39.5, TOP = 255;
const SRC_X = [0.5, 16, 32, 48, 63.5];
// Crust, then mantle (and the head wave, which spent its fast stretch there).
const HUES = [0.47, 0.91];

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, ratio: 1.35, height: 2, src: 0, tau: 0, key: "",
    ph: new Float32Array(N), amp: new Float32Array(N), fast: new Uint8Array(N),
    lut: new Uint8Array(2 * 256 * 3), lh: -1, c: [0, 0, 0],
  };
}

// First arrivals (in band periods) and each LED's band height.
function solve(S) {
  const r = S.ratio, xs = SRC_X[S.src], hs = S.height, ys = YB - hs;
  const ci = sqrt(1 - 1 / (r * r)), ti = 1 / sqrt(r * r - 1);
  const PH = S.ph, A = S.amp, F = S.fast;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    let m = xs;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, i = y * W + x, dx = abs(px - xs);
      // t is the travel time, (gx, gy) the size of its slope along the row
      // and down the column.
      let t, gx, gy;
      if (py < YB) {
        const dy = py - ys, rr = sqrt(dx * dx + dy * dy) + 1e-6, hr = YB - py;
        t = rr;
        gx = dx / rr;
        gy = abs(dy) / rr;
        F[i] = 0;
        if (dx >= (hs + hr) * ti) {
          const th = dx / r + (hs + hr) * ci;
          if (th < t) {
            t = th;
            gx = 1 / r;
            gy = ci;
            F[i] = 1;
          }
        }
      } else {
        // Newton on the crossing point, started from the last LED's.
        const dz = py - YB, a = min(xs, px), b = max(xs, px);
        m = cl(m, a, b);
        for (let k = 0; k < 6; k++) {
          const d1 = sqrt((m - xs) * (m - xs) + hs * hs), d2 = sqrt((px - m) * (px - m) + dz * dz);
          const g = (m - xs) / d1 - (px - m) / (r * d2);
          const gp = (hs * hs) / (d1 * d1 * d1) + (dz * dz) / (r * d2 * d2 * d2);
          m = cl(m - g / gp, a, b);
        }
        const d1 = sqrt((m - xs) * (m - xs) + hs * hs), d2 = sqrt((px - m) * (px - m) + dz * dz) + 1e-6;
        t = d1 + d2 / r;
        gx = abs(px - m) / (r * d2);
        gy = dz / (r * d2);
        F[i] = 1;
      }
      PH[i] = t / P;
      A[i] = min(TOP, (CAP * P) / max(gx, gy, 1e-6));
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1.35, 2], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.ratio = cl(k[2] == null ? 1.35 : k[2], 1.35, 2.5);
  S.height = cl(k[3] == null ? 2 : k[3], 2, 50);
  const b = input.btnPressed;
  if (b && (b[0] || b[1] || b[2] || b[3])) S.src = (S.src + 1) % SRC_X.length;
  S.tau += d * S.speed * 0.5;
  if (S.tau > 1000) S.tau -= 1000;
  const key = S.ratio.toFixed(3) + "/" + S.height.toFixed(2) + "/" + S.src;
  if (key !== S.key) {
    S.key = key;
    solve(S);
  }
}

// One ramp per layer, indexed by the LED's level: saturated in the fading
// tail of a band, paler at the crest.
function ramp(S) {
  if (S.lh === S.hue) return;
  S.lh = S.hue;
  for (let z = 0; z < 2; z++)
    for (let v = 0; v < 256; v++) {
      const a = v / 255;
      hsv(S.hue + HUES[z], 0.9 - 0.5 * a * a * a, a, S.c);
      const o = (z * 256 + v) * 3;
      S.lut[o] = round(S.c[0] * 255);
      S.lut[o + 1] = round(S.c[1] * 255);
      S.lut[o + 2] = round(S.c[2] * 255);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  ramp(S);
  const PH = S.ph, A = S.amp, F = S.fast, Lut = S.lut, tau = S.tau;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let u = tau - PH[i];
      u -= floor(u);
      const o = (F[i] * 256 + round(A[i] * (1 - u))) * 3;
      display.setPixel(x, y, Lut[o], Lut[o + 1], Lut[o + 2]);
    }
}
