// ===== Patternflow pattern =====
// Title:   Pinwheel Tiling
// Family:  geometry
// Idea:    The pinwheel tiling of right triangles with legs 1 and 2 zooms for ever into the fixed point of its one turned child, each tile splitting into five copies a root five smaller, one of them turned by arctan(1/2), so every level brings directions the last one did not have, and each tile is coloured by the direction of its long leg.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: pinwheel tiling (John Conway and Charles Radin, 1994), pattern round 32
// Round:   32
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Size=13..40, Paint=0..1
//
// Knob 1: Hue. Turns the colours against the directions. At 0 a tile whose long leg lies across the panel is cyan, one standing upright red, one along the rising diagonal green and one along the falling diagonal violet; parallel legs share a colour whichever way they point, and mirror-image tiles are a fifth darker.
// Knob 2: Speed. At 2 the view grows by the square root of 5 and turns 26.6 degrees every 3.6 seconds, one level of tiles; at 0.2 a level takes 36 seconds, at 3 it takes 2.4.
// Knob 3: Size. How long a tile's hypotenuse is, 13 to 40 LEDs, when the next level starts to split off it. The new seams come in over the first 30% of the level and the five children take their own colours between 28% and 42%; the seams of tiles two levels older and more grow about one LED wider.
// Knob 4: Paint. At 0 every tile is coloured by its direction. At 1 the tiles are one blue, the hue moving with Hue, each as bright as its long leg points to the lower left, one hand pale and the other deep, so the two hands show in equal numbers.
// Buttons: K1 tap crossfades in 0.8 seconds to the next of four points to dive into: the fixed point of child 2 (turned by arctan(1/2)), of child 3 taken twice, and of the chains 2 then 3 and 3 then 2, where the view turns the other way, 63.4 degrees a level.

const W = 64, H = 128, CX = 31.5, CY = 63.5;
const { floor, sqrt, cos, sin, atan, atan2, log, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const S5 = sqrt(5), LS5 = log(S5), TAU = 2 * PI, A2 = atan(0.5);

// The tile in its own frame: small angle at (0,0), right angle at (2,0),
// large angle at (2,1). Conway's cut: the altitude from the right angle takes
// one copy off the short side; the larger part is cut from the midpoint of
// its hypotenuse to its right angle and to the midpoints of its two legs,
// four copies in two mirror pairs. Each child is [small, right, large] in the
// parent's frame. Children 2 and 3 keep the parent's hand, 0, 1 and 4 are
// mirrored. Cut with the midpoint split instead, the directions stay a
// finite set; with this one they never repeat.
const KIDS = [
  [[2, 0], [1.6, 0.8], [2, 1]],
  [[1, 0], [1.8, 0.4], [2, 0]],
  [[1, 0], [1.8, 0.4], [1.6, 0.8]],
  [[1.6, 0.8], [0.8, 0.4], [1, 0]],
  [[0, 0], [0.8, 0.4], [1, 0]],
].map(([a, b, c]) => {
  const ux = (b[0] - a[0]) / 2, uy = (b[1] - a[1]) / 2, vx = c[0] - b[0], vy = c[1] - b[1], det = ux * vy - vx * uy;
  return { ax: a[0], ay: a[1], ux, uy, vx, vy, i00: vy / det, i01: -vx / det, i10: -uy / det, i11: ux / det, flip: det < 0 };
});

// Points the zoom can dive into, each the fixed point of a chain of children
// that keeps the hand: child 2 alone, a copy a fifth of the area turned by
// arctan(1/2); child 3 twice; 2 then 3; 3 then 2. P is the chain's length in
// levels, R its turn.
const DIVES = [
  { zx: 1.5, zy: 0.5, P: 1, R: A2 },
  { zx: 1.2, zy: 0.4, P: 2, R: 2 * A2 },
  { zx: 1.375, zy: 0.375, P: 2, R: 2 * A2 - PI },
  { zx: 1.125, zy: 0.375, P: 2, R: 2 * A2 - PI },
];
const N0 = 8;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  for (let c = 0; c < 3; c++) out[o + c] = rgb[c] * 255;
}

export function setup(params) {
  params.s = {
    z: 0, hue: 0, speed: 2, size: 13, paint: 0.06, dive: 0, prev: -1, fade: 1,
    lut: new Float32Array(256 * 3 * 4), lutHue: NaN, out: new Float32Array(W * H * 3), tmp: new Float32Array(W * H * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 13, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.size = cl(k[2], 13, 40);
  P.paint = cl(k[3], 0, 1);
  P.z += d * P.speed * 0.14;
  if (P.fade < 1) P.fade = Math.min(1, P.fade + d / 0.8);
  if (input.btnPressed && input.btnPressed[0]) {
    P.prev = P.dive;
    P.dive = (P.dive + 1) % DIVES.length;
    P.fade = 0;
  }
}

// Draws one dive into buf: RGB 0..255 per LED.
function render(P, D, buf) {
  const u = P.z % D.P, S = Math.pow(S5, N0 + u), phi = -D.R * (u / D.P);
  const cp = cos(-phi) / S, sp = sin(-phi) / S;
  // Depth d tiles span S * sqrt5^(1-d) LEDs along the hypotenuse; the deepest
  // drawn is the last one at least Size long, and it fades in.
  const lam = N0 + u + 1 - log(P.size) / LS5, dn = floor(lam), al = sm(0, 0.3, lam - dn), ac = sm(0.28, 0.42, lam - dn);
  // Each level's seam: its scale on the panel, how far it reaches from the
  // edge (a little wider for the older, larger tiles) and how dark it is.
  const sig = new Float32Array(dn + 1), reach = new Float32Array(dn + 1), dark = new Float32Array(dn + 1);
  for (let d = 0; d <= dn; d++) {
    sig[d] = S * Math.pow(S5, -d);
    reach[d] = 1.1 + 0.45 * sm(1, 2.5, lam - d);
    dark[d] = d === dn ? al : 1;
  }
  const lut = P.lut, paint = P.paint;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - CX, dy = y - CY;
      let qx = D.zx + cp * dx - sp * dy, qy = D.zy + sp * dx + cp * dy;
      let m00 = 1, m01 = 0, m10 = 0, m11 = 1, flip = false;
      let a0 = 0, f0 = false, seam = 0;
      for (let d = 1; d <= dn; d++) {
        if (d === dn) (a0 = atan2(m10, m00)), (f0 = flip);
        let best = -9, bi = 0, bx = 0, by = 0;
        for (let i = 0; i < 5; i++) {
          const K = KIDS[i], rx = qx - K.ax, ry = qy - K.ay;
          const tx = K.i00 * rx + K.i01 * ry, ty = K.i10 * rx + K.i11 * ry;
          const mg = Math.min(ty, 2 - tx, (tx - 2 * ty) / S5);
          if (mg > best) (best = mg), (bi = i), (bx = tx), (by = ty);
        }
        const K = KIDS[bi];
        const n00 = m00 * K.ux + m01 * K.uy, n01 = m00 * K.vx + m01 * K.vy, n10 = m10 * K.ux + m11 * K.uy, n11 = m10 * K.vx + m11 * K.vy;
        (m00 = n00), (m01 = n01), (m10 = n10), (m11 = n11), (flip = flip !== K.flip);
        (qx = bx), (qy = by);
        const sd = dark[d] * cl(reach[d] - best * sig[d], 0, 1);
        if (sd > seam) seam = sd;
      }
      const a1 = atan2(m10, m00);
      const o = (y * W + x) * 3;
      // Colour of the tile one level up and of the newest tile, mixed.
      tint(lut, a0 + phi, f0, paint);
      const r0 = cr, g0 = cg, b0 = cb;
      tint(lut, a1 + phi, flip, paint);
      const r = r0 + (cr - r0) * ac, g = g0 + (cg - g0) * ac, b = b0 + (cb - b0) * ac;
      const v = 1 - 0.94 * seam;
      buf[o] = r * v;
      buf[o + 1] = g * v;
      buf[o + 2] = b * v;
    }
}

// A tile's colour from the direction of its long leg on the panel and its
// hand: four tables of 256 directions, by direction and by light, each for
// both hands.
let cr = 0, cg = 0, cb = 0;
function tint(lut, ang, flip, paint) {
  let t = ang / TAU;
  t -= floor(t);
  const i = ((floor(t * 256) & 255) + (flip ? 256 : 0)) * 3, j = i + 1536;
  cr = lut[i] + (lut[j] - lut[i]) * paint;
  cg = lut[i + 1] + (lut[j + 1] - lut[i + 1]) * paint;
  cb = lut[i + 2] + (lut[j + 2] - lut[i + 2]) * paint;
}

function buildLut(P) {
  for (let i = 0; i < 256; i++) {
    const t = i / 256, lit = 0.5 + 0.5 * cos(t * TAU - 2.2);
    hsv(P.hue + 0.55 + 2 * t, 0.78, 1, P.lut, i * 3);
    hsv(P.hue + 0.55 + 2 * t, 0.78, 0.8, P.lut, (256 + i) * 3);
    hsv(P.hue + 0.55, 0.55, 0.35 + 0.65 * lit, P.lut, (512 + i) * 3);
    hsv(P.hue + 0.62, 0.85, 0.25 + 0.6 * lit, P.lut, (768 + i) * 3);
  }
  P.lutHue = P.hue;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  if (P.lutHue !== P.hue) buildLut(P);
  const out = P.out;
  render(P, DIVES[P.dive], out);
  if (P.fade < 1 && P.prev >= 0) {
    render(P, DIVES[P.prev], P.tmp);
    const f = sm(0, 1, P.fade), tmp = P.tmp;
    for (let i = 0; i < out.length; i++) out[i] = tmp[i] + (out[i] - tmp[i]) * f;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, out[o], out[o + 1], out[o + 2]);
    }
}
