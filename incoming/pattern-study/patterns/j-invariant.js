// ===== Patternflow pattern =====
// Title:   J-Invariant
// Family:  fractal
// Idea:    Klein's j function painted over the upper half-plane with the real axis along the foot of the panel: every triangle j maps onto the upper half of its values glows pale gold and every one onto the lower half deep blue, so Klein's tessellation repeats smaller and smaller toward the bottom edge while contour bands of |j| stream out of each zero into the cusps and the window slides along the axis.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the modular j-invariant (Richard Dedekind, 1877; Felix Klein, 1878), drawn by domain colouring, pattern round 29
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=0..1, Bands=0..1
//
// Knob 1: Hue. Turns both colour families round the wheel together; at 0 the triangles are pale gold and deep blue.
// Knob 2: Speed. At 2 a new contour band leaves each zero about every two seconds and the window slides four LEDs a second along the axis; at 0.2 both go ten times slower.
// Knob 3: Depth. Zooms toward the real axis: at 0 the window is two thirds of a period wide and shows the arcs of the fundamental domain; at 1 it is eight times closer and fans of thin tiles round the cusps fill the panel.
// Knob 4: Bands. The contour bands of |j|: a few soft ones at 0, each a factor of nine in |j|; at 1 sharp ones a factor of one and a half apart, too fine to draw in the small tiles, which turn flat.
// Buttons: K1 tap sends a wave of light down the tiles generation by generation, from the tile at the top through each further inversion t -> -1/t to the axis. K2 tap lays the edges of the modular tiles on as thin gold geodesics; tap again to take them off.

const W = 64, H = 128, N = W * H;
const { min, max, floor, exp, log, cos, sin, atan2, sqrt, abs, round, asinh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => ((v = cl((v - a) / (b - a), 0, 1)), v * v * (3 - 2 * v));

// Re units per LED at Depth 0, and how far below the bottom row the real
// axis lies, in LEDs.
const S0 = 1 / 96, GAP = 0.5;

// One point of the half-plane: it is carried into the fundamental domain
// |Re t| <= 1/2, |t| >= 1 by t -> t + n and t -> -1/t, and j is read off
// there, where |q| = |e^(2 pi i t)| <= e^(-pi sqrt 3) < 0.0044, so five terms
// of each q-series are exact to the last bit that shows. The results land in
// OUT: log|j|, arg j, how fast log j turns per unit of the original t, how
// many times t -> -1/t was taken (the tile's generation, counted down from
// the top) and the point in the fundamental domain.
const OUT = new Float64Array(6);
function jAt(x, y) {
  const y0 = y;
  let gen = 0;
  for (; gen < 60; gen++) {
    x -= round(x);
    const r2 = x * x + y * y;
    if (r2 >= 1) break;
    x = -x / r2;
    y = y / r2;
  }
  // q = e^(2 pi i t); E4 and E6 by their divisor sums, and the log of the
  // eta product as L = sum sigma(m)/m q^m, so Delta = q e^(-24 L) and
  // j = E4^3 / Delta.
  const m = exp(-TAU * y), qr = m * cos(TAU * x), qi = m * sin(TAU * x);
  const q2r = qr * qr - qi * qi, q2i = 2 * qr * qi;
  const q3r = q2r * qr - q2i * qi, q3i = q2r * qi + q2i * qr;
  const q4r = q2r * q2r - q2i * q2i, q4i = 2 * q2r * q2i;
  const q5r = q4r * qr - q4i * qi, q5i = q4r * qi + q4i * qr;
  const e4r = 1 + 240 * (qr + 9 * q2r + 28 * q3r + 73 * q4r + 126 * q5r);
  const e4i = 240 * (qi + 9 * q2i + 28 * q3i + 73 * q4i + 126 * q5i);
  const e6r = 1 - 504 * (qr + 33 * q2r + 244 * q3r + 1057 * q4r + 3126 * q5r);
  const e6i = -504 * (qi + 33 * q2i + 244 * q3i + 1057 * q4i + 3126 * q5i);
  const Lr = qr + 1.5 * q2r + (4 / 3) * q3r + 1.75 * q4r + 1.2 * q5r;
  const Li = qi + 1.5 * q2i + (4 / 3) * q3i + 1.75 * q4i + 1.2 * q5i;
  const a4 = e4r * e4r + e4i * e4i + 1e-30;
  OUT[0] = 1.5 * log(a4) + TAU * y + 24 * Lr;
  OUT[1] = 3 * atan2(e4i, e4r) - TAU * x + 24 * Li;
  // d log j / dt = -2 pi i E6 / E4 (Ramanujan's identities), and the map
  // into the domain shrinks lengths by y / y0.
  OUT[2] = TAU * sqrt((e6r * e6r + e6i * e6i) / a4) * (y / y0);
  OUT[3] = gen;
  OUT[4] = x;
  OUT[5] = y;
}

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The phase palette. Where j is real the half-plane is cut into Klein's
// triangles, and j maps each triangle onto one half of the plane of values:
// those onto Im j > 0 take the light family, those onto Im j < 0 the dark
// one, so the two alternate across every edge as in Klein's own figure.
// Across a triangle the phase runs through pi; f runs along a family from the
// edge where j > 0 to the edge where j < 0. 64 steps each, then the mean
// colour the two families blend to where the triangles are too small to draw.
const PN = 64;
function palette(P) {
  const t = P.pal;
  for (let f = 0; f < PN; f++) {
    const u = f / (PN - 1);
    hsv(P.hue + 0.13 - 0.11 * u, 0.5 + 0.25 * u, 1, t, f * 3);
    // A dark orange or olive reads as brown, so the dark family lifts its
    // light where its hue passes through them.
    let h = P.hue + 0.58 + 0.16 * u;
    h -= floor(h);
    const lift = max(0, 1 - abs(h - 0.13) / 0.14);
    hsv(h, 0.9, 0.5 + 0.08 * u + 0.38 * lift, t, (PN + f) * 3);
  }
  for (let c = 0; c < 3; c++) {
    let a = 0;
    for (let f = 0; f < 2 * PN; f++) a += t[f * 3 + c];
    t[2 * PN * 3 + c] = a / (2 * PN);
  }
  P.palHue = P.hue;
}

export function setup(params) {
  params.s = { x: 0.18, flow: 0, hue: 0, depth: 0, bands: 0.06, gold: 0, g: 0, wave: -1, pal: new Float32Array((2 * PN + 1) * 3), palHue: -1, buf: new Float32Array(N * 3) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const sp = cl(k[1], 0.2, 3);
  P.hue = k[0];
  P.depth = cl(k[2], 0, 1);
  P.bands = cl(k[3], 0, 1);
  // The window slides about four LEDs a second at Speed 2, whatever the
  // zoom. j repeats every 1 along the axis.
  const s = S0 * 8 ** -P.depth;
  P.x = (P.x + d * sp * 2 * s) % 1;
  P.flow += d * sp * 0.22;
  const b = input.btnPressed || [];
  // K1 sends a wave of light down the generations, two and a half a
  // second; K2 lays the gold edges on or takes them off.
  if (b[0]) P.wave = 0;
  if (P.wave >= 0) P.wave = P.wave > 30 ? -1 : P.wave + d * 2.5;
  if (b[1]) P.gold = 1 - P.gold;
  P.g += (P.gold - P.g) * min(1, d * 5);
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  if (P.palHue !== P.hue) palette(P);
  const s = S0 * 8 ** -P.depth, buf = P.buf, pal = P.pal, MEAN = 2 * PN * 3;
  // Bands: nepers of |j| per band, how much of each band is ramp, and how
  // dark a band starts.
  const L = 2.2 * 0.18 ** P.bands, ramp = 0.85 - 0.6 * P.bands, lo = 0.6 - 0.32 * P.bands;
  for (let py = 0, p = 0; py < H; py++) {
    const y = (H - py - 0.5 + GAP) * s;
    for (let px = 0; px < W; px++, p += 3) {
      jAt(P.x + (px + 0.5 - W / 2) * s, y);
      // How fast log j turns per LED. Near an image of i it stalls while
      // the tiles round it stay small, so the tile size at this height,
      // about y, sets a floor; and the last rows above the axis, where every
      // tile is a few LEDs at most, fade whatever it says.
      const g = max(OUT[2] * s, (5 * s) / y), hf = sm(2.5, 9, y / s);
      // A band or a phase turn per LED or more cannot be drawn; the colour
      // there would be static. Contrast and colour fade as they crowd, and
      // the light with them, so the cusps and the axis sink into the dark
      // instead of shimmering.
      const cb = (1 - sm(0.25, 0.55, g / L)) * hf, ch = (1 - sm(0.3, 0.7, g / PI)) * hf;
      let u = OUT[0] / L - P.flow;
      u -= floor(u);
      // A sawtooth: each band brightens slowly and drops at its edge.
      const saw = u < ramp ? u / ramp : (1 - u) / (1 - ramp);
      const v = ((lo + (1 - lo) * saw) * cb + 0.78 * (1 - cb)) * (0.3 + 0.7 * ch);
      let a = OUT[1] / TAU;
      a -= floor(a);
      const up = a < 0.5, f = up ? 2 * a : 2 - 2 * a, fi = (f * (PN - 1)) | 0, o = (up ? fi : PN + fi) * 3;
      // Half an LED either side of a triangle edge the two families blend.
      const e = (min(f, 1 - f) * PI) / g, w = e < 0.5 ? 0.5 - e : 0, o2 = (up ? PN + fi : fi) * 3;
      let r = pal[o] + (pal[o2] - pal[o]) * w, gg = pal[o + 1] + (pal[o2 + 1] - pal[o + 1]) * w, b = pal[o + 2] + (pal[o2 + 2] - pal[o + 2]) * w;
      r = (r * ch + pal[MEAN] * (1 - ch)) * v * 255;
      gg = (gg * ch + pal[MEAN + 1] * (1 - ch)) * v * 255;
      b = (b * ch + pal[MEAN + 2] * (1 - ch)) * v * 255;
      if (P.wave >= 0) {
        // The wave: a tile flares as the front reaches its generation and
        // keeps a little of the light for a while after.
        const dw = P.wave - OUT[3], fl = max(exp(-dw * dw * 3), dw > 0 ? 0.35 * exp(-dw * 0.7) : 0) * (0.3 + 0.7 * ch);
        r += (255 - r) * fl * 0.8;
        gg += (250 - gg) * fl * 0.8;
        b += (235 - b) * fl * 0.8;
      }
      if (P.g > 0.01) {
        // The tile edges as gold geodesics a LED wide, faded where the
        // tiles are too small to draw. The hyperbolic distance to the nearer
        // of the walls Re = +-1/2 and the floor |t| = 1, times y, is the
        // distance on the panel.
        const X = OUT[4], Y = OUT[5], e2 = (asinh(min(0.5 - abs(X), (X * X + Y * Y - 1) / 2) / Y) * y) / s;
        const w2 = cl(1.1 - e2, 0, 1) * P.g * ch;
        r += (255 - r) * w2;
        gg += (205 - gg) * w2;
        b += (90 - b) * w2;
      }
      buf[p] = r;
      buf[p + 1] = gg;
      buf[p + 2] = b;
    }
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
