// ===== Patternflow pattern =====
// Title:   Kagome Tiles
// Family:  geometry
// Idea:    A hexagon sits on every point of a triangular lattice and the gaps between them are cut into upward and downward triangles, so one number, the size of the hexagon against the spacing of the lattice, takes the picture from a tiling of triangles with small hexagons at its corners, through a honeycomb of three kinds of regular hexagon, to the tiling where hexagons and triangles meet two and two at every corner.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the trihexagonal tiling (Johannes Kepler, Harmonices Mundi, 1619, year from memory), the kagome lattice (named by Itiro Syozi, 1951, year from memory), original, pattern round 133
// Round:   133
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Ratio=0..4, Size=-1..1, Turn=0..1
//
// Knob 1: Hue. Turns the colour of the hexagons round the wheel; the upward triangles are a third of a wheel on from them and the downward ones two thirds.
// Knob 2: Ratio. How wide the hexagon is against the lattice spacing, from 15 percent to all of it. At the middle of the knob it is two thirds and the three kinds of tile are the same regular hexagon; at the right the hexagons touch at their corners and the gaps are whole triangles.
// Knob 3: Size. The spacing of the lattice, from 12 LEDs to 43; the middle is 24.
// Knob 4: Turn. How far the whole tiling is turned about the middle of the panel, from 0 to 30 degrees. At the left its rows run across the panel with the hexagon corners pointing sideways; at the right they run up it with the flat sides facing sideways.

const W = 64;
const H = 128;
const SQ3 = Math.sqrt(3);
const HALF_SQ3 = SQ3 / 2;

function hsv(h, s, v, out) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[0] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.d = 24;
  params.s = 2 / 3;
  params.cos = 1;
  params.sin = 0;
  params.hex = new Float32Array(3);
  params.up = new Float32Array(3);
  params.down = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.d = 24 * Math.pow(1.8, k[2]) * (1 + 0.035 * Math.sin(params.t * 0.31));
  // The hexagon's width against the spacing: 0.15 at the left of the knob, 2/3 at the middle, 1 at the right.
  const s = 0.15 + 0.85 * Math.pow(Math.max(0, k[1]) / 4, 0.72);
  params.s = Math.min(1, s) * (1 - 0.025 * (0.5 + 0.5 * Math.sin(params.t * 0.43)));
  const turn = (k[3] * 30 + 2 * Math.sin(params.t * 0.37 + 0.7)) * (Math.PI / 180);
  params.cos = Math.cos(turn);
  params.sin = Math.sin(turn);
  hsv(k[0] + 0.1, 0.9, 1, params.hex);
  hsv(k[0] + 0.45, 0.85, 0.78, params.up);
  hsv(k[0] + 0.78, 0.85, 0.52, params.down);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function draw(display, params, time) {
  const D = params.d;
  const R = (params.s * D) / 2;
  const apothem = R * HALF_SQ3;
  const cs = params.cos;
  const sn = params.sin;
  const rowH = D * HALF_SQ3;
  const hex = params.hex;
  const up = params.up;
  const down = params.down;
  for (let y = 0; y < H; y++) {
    const oy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const ox = x + 0.5 - W / 2;
      // The tiling is turned about the middle of the panel, so the lattice is read in a frame turned the other way.
      const dx = ox * cs + oy * sn;
      const dy = -ox * sn + oy * cs;
      const b = dy / rowH;
      const j0 = Math.floor(b);
      const fb = b - j0;
      const a = dx / D - b / 2;
      const i0 = Math.floor(a);
      const fa = a - i0;
      // The nearest lattice point is the middle of this LED's hexagon.
      let best = 1e9;
      let qx = 0;
      let qy = 0;
      for (let dj = 0; dj < 2; dj++) {
        const py = (j0 + dj) * rowH;
        for (let di = 0; di < 2; di++) {
          const px = (i0 + di + (j0 + dj) / 2) * D;
          const ex = dx - px;
          const ey = dy - py;
          const dd = ex * ex + ey * ey;
          if (dd < best) {
            best = dd;
            qx = ex;
            qy = ey;
          }
        }
      }
      const dh = Math.max(Math.abs(qx * HALF_SQ3 + qy * 0.5), Math.abs(qy), Math.abs(-qx * HALF_SQ3 + qy * 0.5)) - apothem;
      const cover = clamp01(0.5 - dh);
      // The gap is an upward triangle of the lattice or a downward one, and the two meet in a straight cut.
      const isUp = fa + fb < 1;
      const edge = (isUp ? Math.min(fa, fb, 1 - fa - fb) : Math.min(1 - fa, 1 - fb, fa + fb - 1)) * rowH;
      const other = clamp01(0.5 - edge) * 0.5;
      const own = isUp ? up : down;
      const oth = isUp ? down : up;
      let r = own[0] + (oth[0] - own[0]) * other;
      let g = own[1] + (oth[1] - own[1]) * other;
      let bl = own[2] + (oth[2] - own[2]) * other;
      r += (hex[0] - r) * cover;
      g += (hex[1] - g) * cover;
      bl += (hex[2] - bl) * cover;
      display.setPixel(x, y, r, g, bl);
    }
  }
}
