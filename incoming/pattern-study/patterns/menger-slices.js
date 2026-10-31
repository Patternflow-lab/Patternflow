// ===== Patternflow pattern =====
// Title:   Menger Slices
// Family:  fractal
// Idea:    A plane square to the long diagonal of a Menger sponge sweeps from corner to corner and back, every LED kept or cut by the base-3 digit test, so the section grows from a point into a triangle and a hexagon whose biggest hole turns from a triangle into a six-pointed star and on into a triangle the other way up, while below it the centre section holds the lace of stars still and every hole is coloured by the level that cut it.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Menger sponge (Karl Menger, 1926), cut across its long diagonal by the planes x + y + z = c, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=3..5, Zoom=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the kept sponge is pale cream, pinker near the corner the plane starts from and paler lime near the far one, and the holes run from dark teal for the first cut through blue, indigo and purple to magenta for the fifth. The holes skip orange and yellow, which read brown and olive when dark.
// Knob 2: Speed. At 2 the plane takes 12 s from corner to corner and 24 s there and back, and first crosses the centre 5 s in; 120 s a way at 0.2 and 8 s at 3.
// Knob 3: Depth. How many levels are cut, 3 to 5, the next level fading in as the knob turns between whole numbers. The upper view puts 43 LEDs on the cube's edge, so a third-level hole, a cube a 27th of the edge, is 1.6 LEDs; a fourth-level one is 0.53 LEDs and comes through as single LEDs in a moire, whole only in the lower view with Zoom turned up.
// Knob 4: Zoom. The lower view. Up to 0.1 it is the whole centre section; past it the view magnifies about the section's right corner, the edge midpoint (1, 0, 1/2), up to 9 times at 1. At 0.55 it is 3 times and the lace comes back one level down, each hole in the next level's colour: the small cube at (2, 0, 1)/3 is cut through its own centre just as the whole cube is.

// Karl Menger's sponge keeps a point of the unit cube when, at no place of
// the base-3 expansions of its coordinates, two of the three digits are 1.
// Each level cuts the cube into 27 and takes out the 7 whose position has
// two or three 1s: the centre and the middle of each face. Every LED here
// is that test, run on the point of the plane under it, level by level
// until a level cuts it or the depth runs out.
//
// The planes x + y + z = c stand square to the diagonal from (0, 0, 0) to
// (1, 1, 1). The section is a point at c = 0, a triangle up to c = 1, a
// hexagon from 1 to 2, a triangle the other way up to 3. At c = 3/2 the
// hole the first level cuts is a six-pointed star: the centre cube gives a
// hexagon, and the three face cubes below the plane and the three above it
// each add a triangle, all six the same size only there. Below 3/2 the
// three from above shrink away and the hole becomes a triangle; further
// down it opens into three lobes, the face cubes' own hexagons, and towards
// the corner it is three small triangles. Above 3/2 the same happens the
// other way up. The same holds inside every kept small cube the plane cuts
// through its centre, which is why the centre section is a lace of stars.
//
// In the plane, u runs across the panel along (1, -1, 0) / sqrt 2 and w up
// it along (-1, -1, 2) / sqrt 6, from where the diagonal pierces it.

const W = 64, H = 128;
const { floor, ceil, round, sqrt, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const R2 = sqrt(2), R6 = sqrt(6);

// Upper view: rows 0..70, the moving section; row 71 the gauge; lower
// view: rows 72..127, the centre section.
const TOP = 71, GAUGE = 71, SCALE_T = 43, SCALE_B = 44;
const CXT = 31.5, CYT = 35.5, CXB = 31.5, CYB = 99.5;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = (i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p) * 255;
  out[1] = (i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p) * 255;
  out[2] = (i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p) * 255;
  return out;
}

// The level at which (x, y, z) is cut away, 0 if it is kept to depth K,
// -1 outside the cube.
function cut(x, y, z, K) {
  if (x < 0 || y < 0 || z < 0 || x >= 1 || y >= 1 || z >= 1) return -1;
  for (let k = 1; k <= K; k++) {
    x *= 3; y *= 3; z *= 3;
    const a = floor(x), b = floor(y), c = floor(z);
    if ((a === 1 ? 1 : 0) + (b === 1 ? 1 : 0) + (c === 1 ? 1 : 0) >= 2) return k;
    x -= a; y -= b; z -= c;
  }
  return 0;
}

export function setup(params) {
  params.s = { t: 0, hue: 0, depth: 3, zoom: 0, hole: [], kept: [0, 0, 0], tmp: [0, 0, 0] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.depth = cl(k[2] == null ? 3 : k[2], 3, 5);
  S.zoom = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t += (d * speed) / 2;
}

// Hole colours by level, dark for the first cut and a little lighter for
// each finer one. Their hues go round a wheel with orange and yellow (0.03
// to 0.2) cut out, since dark they read brown and olive on the panel.
const wheel = (h) => 0.2 + (h - floor(h)) * 0.83;
function palette(S) {
  for (let k = 1; k <= 5; k++) S.hole[k] = hsv(wheel(S.hue + 0.36 + 0.13 * (k - 1)), 0.88, 0.3 + 0.05 * (k - 1), [0, 0, 0]);
}

function keptColour(S, c, w) {
  return hsv(S.hue + 0.1 + 0.08 * (c - 1.5), 0.22 + 0.12 * w, 0.95, S.kept);
}

function put(display, x, y, c) {
  display.setPixel(x, y, round(c[0]), round(c[1]), round(c[2]));
}

// One view: the plane x + y + z = cc, a point u across and w up from where
// the diagonal pierces it, magnified m times about (vu, 0).
function view(display, S, y0, y1, cx, cy, sc, cc, m, vu) {
  const D = S.depth, K = ceil(D - 1e-6), f = D - (K - 1), b = cc / 3, mix = S.tmp;
  for (let j = y0; j < y1; j++) {
    const w = (cy - j) / sc / m;
    const kc = keptColour(S, cc, w);
    for (let i = 0; i < W; i++) {
      const u = vu + ((i - cx) / sc - vu) / m;
      const lev = cut(b + u / R2 - w / R6, b - u / R2 - w / R6, b + (2 * w) / R6, K);
      if (lev < 0) display.setPixel(i, j, 0, 0, 0);
      else if (lev === 0) put(display, i, j, kc);
      else if (lev < K || f >= 1) put(display, i, j, S.hole[lev]);
      else {
        // The deepest level fades in as Depth turns past a whole number.
        const h = S.hole[lev];
        mix[0] = kc[0] + (h[0] - kc[0]) * f;
        mix[1] = kc[1] + (h[1] - kc[1]) * f;
        mix[2] = kc[2] + (h[2] - kc[2]) * f;
        put(display, i, j, mix);
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  palette(S);
  // The plane sweeps from corner to corner and back, 12 s a way at Speed 2,
  // starting at c = 1/4.
  const ph = (S.t / 12 + 1 / 12) % 2, c = 3 * (ph < 1 ? ph : 2 - ph);
  view(display, S, 0, TOP, CXT, CYT, SCALE_T, c, 1, 0);
  // The gauge: the long diagonal from (0, 0, 0) at the left to (1, 1, 1)
  // at the right, the plane a bright tick on it, the centre a dim one.
  const tick = round((c / 3) * 62), g = hsv(S.hue + 0.1, 0.2, 0.22, [0, 0, 0]), hi = keptColour(S, c, 0);
  for (let i = 0; i < W; i++) put(display, i, GAUGE, i === tick || i === tick + 1 ? hi : i === 31 || i === 32 ? S.hole[3] : g);
  const z = cl((S.zoom - 0.1) / 0.9, 0, 1);
  view(display, S, GAUGE + 1, H, CXB, CYB, SCALE_B, 1.5, pow(9, z), 1 / R2);
}
