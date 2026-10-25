// ===== Patternflow pattern =====
// Title:   Möbius Loxodrome
// Family:  geometry
// Idea:    The flow of a Möbius transformation with a source above the panel and a sink below it: a conformal checkerboard, every tile streaked with bright sawtooth ripples, pours out of the source and into the sink along circles, and along double spirals once the transformation is turned loxodromic.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Möbius transformations (August Ferdinand Möbius, 1855), the loxodromic case, drawn as a conformal checkerboard shaded like an enhanced phase portrait (Elias Wegert, 2012), pattern round 43
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Twist=0..1, Poles=0..1
//
// Knob 1: Hue. Turns both colours of the checker round the wheel together. At 0 the tiles are teal and magenta, at 0.25 violet and orange, at 0.6 green and coral; where a colour lands on orange, the dark half of each ripple is turned towards rose so it does not read brown.
// Knob 2: Speed. How fast the plane streams from the source to the sink. At 2 the multiplier is 1.068 a second, so a ring of tiles passes every 5.3 seconds and a tile in the middle moves 3.3 LEDs a second; at 0.2 a ring takes 53 seconds, at 3 it takes 3.5. The axis through the two fixed points also rocks 7 degrees either way, once in 42 seconds at 2.
// Knob 3: Twist. The argument of the multiplier. At 0 the transformation is hyperbolic: the tiles run straight down the circles through both fixed points. Turned up, it turns loxodromic and the lanes of tiles wind into spirals; at 1 they cross the circles through the fixed points at 54 degrees and the plane turns 3.1 degrees a second about each fixed point while it streams.
// Knob 4: Poles. How far the fixed points stand beyond the panel's top and bottom edges: 38 LEDs at 0, so the middle tiles are 17 LEDs across and the rings only bow, down to 0 at 1, where they sit on the middle of the edges, the lanes fan out of them and the tiles shrink into a pale glow there.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, sin, cos, atan2, log, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// In w = log((z - p) / (z - q)) the transformation z -> (az + b) / (cz + d)
// that fixes p and q is a shift by log k, k its multiplier, so a picture
// drawn in w and slid along log k is the flow. The picture: a checker whose
// rows are the flow lines, and over it ripples, a sawtooth whose drops run at
// 45 degrees to the flow. On the panel those come out near diagonal, so a
// ripple climbs about 30 levels from one LED to the next along a row and
// along a column alike, and only its drop is a hard edge.
//
// The tiling of the w-plane. w is only defined up to 2 pi i, so it has to
// close up when v goes once round: LANES flow lanes round each fixed point
// (even, so the checker closes too), ARMS ripple arms, and rings spaced
// RING apart in u.
const LANES = 18, ARMS = 42, RING = (2 * PI) / LANES;
// The steepest a ripple may rise from one LED to the next along a row or a
// column, in levels of 255. Where the ripples crowd, near a fixed point, their
// height is cut so a rise never passes it.
const LIM = 38;
// How far the fixed points stand beyond the panel's top and bottom, in LEDs,
// at Poles 0 and 1.
const FAR = 38, NEAR = 0;

export function setup(params) {
  params.s = { hue: 0, speed: 2, twist: 0, poles: 0.06, T: 0, clock: 0, rgb: new Float64Array(3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.twist = cl(k[2], 0, 1);
  S.poles = cl(k[3], 0, 1);
  // T is how far the flow has carried the w-plane along log k.
  S.T += d * S.speed * 0.033;
  S.clock += d * S.speed;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb;
  // The fixed points: p above, q below, on an axis through the middle of the
  // panel that rocks slowly from side to side.
  const R = 64 + FAR + (NEAR - FAR) * S.poles, sway = 0.12 * sin(S.clock * 0.075);
  const px = 32 - R * sin(sway) + 1e-4, py = 64 - R * cos(sway), qx = 32 + R * sin(sway) + 1e-4, qy = 64 + R * cos(sway);
  const dx = px - qx, dy = py - qy;
  // log k = |log k| e^(i beta): beta 0 is hyperbolic, the flow running
  // straight along the circles through p and q; beta > 0 is loxodromic.
  const beta = S.twist * 0.95, cb = cos(beta), sb = sin(beta), tb = sb / cb;
  // Ripples at 45 degrees to the flow: r = ARMS v / 2 pi + kap u.
  const m = ARMS / (2 * PI), kap = m / Math.tan(beta + PI / 4), rw = sqrt(kap * kap + m * m);
  const ou = S.T * cb, ov = S.T * sb;
  const h0 = S.hue + 0.48, h1 = S.hue + 0.84;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ax = x + 0.5 - px, ay = y + 0.5 - py, bx = x + 0.5 - qx, by = y + 0.5 - qy;
      // w = log((z - p) / (z - q)), moved back along the flow.
      const u = 0.5 * log((ax * ax + ay * ay) / (bx * bx + by * by)) - ou;
      const v = atan2(ay, ax) - atan2(by, bx) - ov;
      // dw/dz = (p - q) / ((z - p)(z - q)): how far w moves over one LED.
      const mr = ax * bx - ay * by, mi = ax * by + ay * bx, mm = mr * mr + mi * mi;
      const wr = (dx * mr + dy * mi) / mm, wi = (dy * mr - dx * mi) / mm, sc = sqrt(wr * wr + wi * wi);
      // The checker: rows are the flow lines, cut by the circles round p.
      const a = u / RING, b = (v - u * tb) / RING;
      const odd = (floor(a) + floor(b)) & 1;
      // The ripple's sawtooth: dark, rising to a bright crest, then a drop.
      const r = m * v + kap * u, f = r - floor(r);
      const gx = kap * wr + m * wi, gy = m * wr - kap * wi;
      const amp = min(1, LIM / 255 / max(abs(gx), abs(gy)));
      let lev = 1 - amp + amp * f;
      // Ripples narrower than 2.8 LEDs fade into the glow of the fixed point,
      // gone under 1.6, and the checker after them, from 6 LEDs to 3.
      const pr = 1 / (rw * sc), fr = cl((pr - 1.6) / 1.2, 0, 1), ft = cl((RING / sc - 3) / 3, 0, 1);
      const core = cl(1 - pr / 1.6, 0, 1);
      lev = lev * fr + (0.6 + 0.4 * core) * (1 - fr);
      let h = odd ? h1 : h0;
      // An orange family turns towards rose and plum in its dark half, which
      // would read brown on the panel.
      const warm = max(0, 1 - abs(h - floor(h) - 0.095) / 0.09);
      h -= 0.17 * warm * (1 - f) * fr;
      const sat = ((f > 0.8 ? 0.55 : 0.88) * fr + 0.45 * (1 - fr)) * ft + 0.4 * (1 - ft);
      hsv(h * ft + (0.5 * (h0 + h1) + 0.25) * (1 - ft), sat * (1 - core), lev, rgb);
      display.setPixel(x, y, round(rgb[0] * 255), round(rgb[1] * 255), round(rgb[2] * 255));
    }
}
