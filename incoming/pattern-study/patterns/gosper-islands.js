// ===== Patternflow pattern =====
// Title:   Gosper Islands
// Family:  fractal
// Idea:    An endless zoom into the plane tiled with Gosper islands, worked out for every LED from its digits in base 2 - w over the Eisenstein integers, so seven islands always make one island the square root of 7 larger and turned 19.1 degrees, each turn of the loop grows the picture by exactly that, the big islands take their colour from one digit and their shade from the next, and the coasts between them are drawn as bright crinkled lines.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gosper island, the boundary of the flowsnake curve (Bill Gosper, 1973; published by Martin Gardner, Scientific American, December 1976; named by Benoit Mandelbrot, The Fractal Geometry of Nature, 1982), here as the tile of the base 2 - w number system on the Eisenstein integers with digits 0 and the six units; pattern round 100
// Round:   100
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Depth=1..3, Hexagon=0..1
//
// Knob 1: Hue. Turns the seven island colours round the wheel together. At 0 they run green, teal, cyan, azure (the centre island of each cluster), blue, violet and pink, and the coasts are the same hues paled almost to white; at 0.5 they run violet, pink, red, orange (the centre), yellow, green and teal.
// Knob 2: Speed. At 2 one turn of the loop, a zoom of 2.65 times and a turn of 19.1 degrees, takes 7 s; 70 s at 0.2 and 4.7 s at 3.
// Knob 3: Depth. How far down the coasts go. At the opening 1 they are drawn for islands whose centres sit 7.8 LEDs apart or more, fading in up to 20.7 and two LEDs wide from 12.7 up; at 3 they reach islands 2.4 LEDs apart, so every island shows its own seven sub-islands as a fine lace.
// Knob 4: Hexagon. Builds each island from coarser pieces, undoing the fractal one level at a time. Below 0.15 every coast is worked out from pieces under one LED, the true island; up to 0.45 from 49 hexagons an island, up to 0.8 from 7 (Gosper's flower), and above 0.8 every island is a plain hexagon, the tiling the islands grew from.

// Eisenstein integers are the numbers a + b w with w = e^(2 pi i / 3); they
// sit on the triangular lattice. The base beta = 2 - w has norm
// 4 + 2 + 1 = 7, so there are seven classes mod beta, and 0 and the six
// units 1, 1 + w, w, -1, w^2, -w (in order round the circle) are one of
// each. In the quotient w = 2, so a + b w falls in class (a + 2b) mod 7.
// Take that digit off and divide by beta:
//
//   (x + y w) / (2 - w) = ((3x - y) + (x + 2y) w) / 7,
//
// exact once the digit is gone. Repeating it writes every Eisenstein integer
// as a finite sum of digits times powers of beta: checked for all 361,201
// with |a| and |b| up to 300, none needs more than 8 digits.
//
// The points sum d_k beta^-k over k >= 1 form one tile T, with
// beta T = T and its six neighbours T + u. Those seven pieces are the centre
// and the hexagonal ring, so T is the Gosper island: seven of it make one
// sqrt 7 = 2.65 times larger, turned by the angle of beta, arctan(sqrt 3 / 5)
// = 19.1 degrees, and copies of T on every lattice point tile the plane.
// Level l islands are beta^l (T + g); a point's island at level l is what
// remains of its nearest lattice point at level 0 after l digits are taken
// off, and the l-th digit says which of the seven pieces of its level
// l + 1 island it sits in.
//
// The camera looks at the plane through z beta^-t, t the loop phase from 0
// to 1. Multiplying by beta moves every level up by one, so at t = 1 the
// picture is the one at t = 0 with every level renamed: the zoom loops with
// no seam. Level l sits 0.16 * sqrt(7)^(l + t) LEDs apart on the panel,
// level 0 under one LED, so the coast of every island larger than that is
// right to the LED; eight levels reach islands larger than the panel.
//
// Each LED takes its hue from the digit of its island at the level whose
// centres sit 55 LEDs apart, and its shade from the digit one level down,
// the centre piece brightest. Both slide one level down over the loop,
// smoothstepped, so a piece grows into the colour of its own digit as its
// parent leaves the panel.
// A coast is where two neighbouring LEDs lie in different islands of a
// level; levels fade in by size, and the largest draw both sides.
// The zoom centre is the panel centre, the centre of the centre island at
// every level, so the clusters spiral out round it.

const W = 64, H = 128, N = W * H;
const { floor, round, sqrt, cos, sin, atan2, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const S3 = sqrt(3);
// The angle of beta = 2 - w = 5/2 - i sqrt(3)/2.
const ARG = atan2(-S3 / 2, 2.5);
// Spacing of level 0 on the panel at t = 0, levels worked out, seconds a
// loop at Speed 1, and the level that colours.
const L0 = 0.16, LV = 8, CYCLE = 14, FL = 5;
// Class r = (a + 2b) mod 7 of a + b w: the digit in that class, and its
// place round the circle (-1 for the centre).
const DA = [0, 1, 0, 1, -1, 0, -1], DB = [0, 0, 1, 1, -1, -1, 0];
const ANG = [-1, 0, 2, 1, 4, 5, 3];
// Shade of a piece by its place: the centre full, the ring alternating.
const SHADE = ANG.map((a) => (a < 0 ? 1 : a % 2 ? 0.6 : 0.78));
// Hue step of a piece by its place, the centre in the middle of the band.
const BAND = ANG.map((a) => 0.3 + 0.1 * (a < 0 ? 3 : a < 3 ? a : a + 1));

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

export function setup(params) {
  params.s = { t: 0, hue: 0, depth: 1, hex: 0.06, key: new Int32Array(LV * N), dig: new Uint8Array(LV * N) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 1, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.depth = cl(k[2] == null ? 1 : k[2], 1, 3);
  S.hex = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.t = (S.t + (d * speed) / CYCLE) % 1;
}

// For every LED and level, the island (as a key) and its digit. An island
// at level l is built from the nearest lattice point at level l - n, so n
// levels of pieces; n = LV means from level 0.
function islands(S, n) {
  const t = S.t, key = S.key, dig = S.dig, kr = [], ki = [];
  for (let l = 0; l < LV; l++) {
    // z beta^-(l + t), divided by the level 0 spacing.
    const m = pow(7, -(l + t) / 2) / L0, ph = -ARG * (l + t);
    kr.push(m * cos(ph));
    ki.push(m * sin(ph));
  }
  for (let y = 0; y < H; y++) {
    const zy = y - 63.5;
    for (let x = 0; x < W; x++) {
      const zx = x - 31.5, p = y * W + x;
      let from = -1, a = 0, b = 0, at = 0;
      for (let l = 0; l < LV; l++) {
        const f = l - n < 0 ? 0 : l - n;
        if (f !== from) {
          // Nearest lattice point: the rhombus of 1 and w is two equilateral
          // triangles, so it is one of the four corners.
          const cx = zx * kr[f] - zy * ki[f], cy = zx * ki[f] + zy * kr[f];
          const bf = (2 * cy) / S3, af = cx + bf / 2;
          const a0 = floor(af), b0 = floor(bf), fa = af - a0, fb = bf - b0;
          let best = 1e9;
          for (let c = 0; c < 4; c++) {
            const da = fa - (c & 1), db = fb - (c >> 1), d2 = da * da - da * db + db * db;
            if (d2 < best) {
              best = d2;
              a = a0 + (c & 1);
              b = b0 + (c >> 1);
            }
          }
          from = at = f;
        }
        while (at < l) {
          const r = (((a + 2 * b) % 7) + 7) % 7;
          a -= DA[r];
          b -= DB[r];
          const na = (3 * a - b) / 7;
          b = (a + 2 * b) / 7;
          a = na;
          at++;
        }
        key[l * N + p] = a * 8192 + b;
        dig[l * N + p] = (((a + 2 * b) % 7) + 7) % 7;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const hx = S.hex;
  islands(S, hx < 0.15 ? LV : hx < 0.45 ? 2 : hx < 0.8 ? 1 : 0);
  const t = S.t, key = S.key, dig = S.dig, wf = t * t * (3 - 2 * t);
  // Coast strength by level: fades in over one level from u0, and the
  // smaller islands stay dimmer.
  const u0 = 4 - (S.depth - 1) * 0.6, cw = [];
  for (let l = 0; l < LV; l++) {
    const u = l + t;
    cw.push(l === 0 ? 0 : cl(u - u0, 0, 1) * (0.5 + 0.5 * cl((u - 2.5) / 3, 0, 1)));
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const r2 = dig[(FL + 1) * N + p], r1 = dig[FL * N + p], r0 = dig[(FL - 1) * N + p];
      const hh = S.hue + BAND[r2] + (BAND[r1] - BAND[r2]) * wf;
      const sh = SHADE[r1] + (SHADE[r0] - SHADE[r1]) * wf;
      let c = 0;
      for (let l = 1; l < LV; l++) {
        if (cw[l] <= c) continue;
        const o = l * N + p, kk = key[o];
        const both = l + t > 4.5;
        if ((x < W - 1 && key[o + 1] !== kk) || (y < H - 1 && key[o + W] !== kk) || (both && ((x > 0 && key[o - 1] !== kk) || (y > 0 && key[o - W] !== kk)))) c = cw[l];
      }
      const col = hsv(hh, 0.82 * (1 - 0.75 * c), 0.48 * sh + (1 - 0.48 * sh) * c);
      display.setPixel(x, y, round(col[0] * 255), round(col[1] * 255), round(col[2] * 255));
    }
  }
}
