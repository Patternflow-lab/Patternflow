// ===== Patternflow pattern =====
// Title:   Tumbling Blocks
// Family:  geometry
// Idea:    Three edge vectors that sum to nothing tile the plane with three kinds of rhombus, and shaded light, mid and dark they read as a lattice of cubes seen from one corner, so stretching or leaning the three vectors alone turns the same lattice to look from another side.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the rhombille tiling and its tumbling-blocks quilt, parallel projection of a cube lattice (Karl Pohlke's theorem, 1853, year from memory), original, pattern round 132
// Round:   132
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Stretch=0.8..4, Size=0..1, Lean=-0.8..0.8
//
// Knob 1: Hue. Turns the colour of the whole lattice round the wheel; the three faces of a cube keep their light, mid and dark tones.
// Knob 2: Stretch. How tall the cube's vertical edge is against its width. Low, the three faces flatten into thin slats; at 2 the edges are equal and the lattice is the classic isometric cube; high, the cubes become tall columns.
// Knob 3: Size. The width of one cube, from 20 LEDs to 48.
// Knob 4: Lean. Leans the vertical edges to one side or the other, from a quarter turn to the left through upright to a quarter turn to the right, so the cubes slide from one view to another.

const W = 64;
const H = 128;
const SQ3 = Math.sqrt(3);

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
  params.hue = 0.6;
  params.ratio = 1.1547;
  params.w = 16;
  params.lean = 0;
  params.faces = [new Float32Array(3), new Float32Array(3), new Float32Array(3)];
  params.quad = new Float32Array(8);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.hue = k[0] + 0.6;
  // Two on the knob is the isometric cube: its vertical edge is 2/sqrt(3) times the half width.
  params.ratio = k[1] * 0.57735 * (1 + 0.035 * Math.sin(params.t * 0.5));
  params.w = 10 + 14 * k[2];
  params.lean = k[3] + 0.04 * Math.sin(params.t * 0.37 + 1);
  // Light, mid and dark: the top, the left and the right face.
  hsv(params.hue, 0.45, 1.0, params.faces[0]);
  hsv(params.hue + 0.05, 0.85, 0.74, params.faces[1]);
  hsv(params.hue + 0.1, 0.95, 0.42, params.faces[2]);
}

// Distance from a point inside a convex quad to its nearest side.
function inside(px, py, v) {
  let best = 1e9;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) & 3;
    const ax = v[2 * i];
    const ay = v[2 * i + 1];
    const bx = v[2 * j];
    const by = v[2 * j + 1];
    const ex = bx - ax;
    const ey = by - ay;
    const d = Math.abs(ex * (py - ay) - ey * (px - ax)) / Math.hypot(ex, ey);
    if (d < best) best = d;
  }
  return best;
}

export function draw(display, params, time) {
  const w = params.w;
  const c = w * params.ratio;
  const s = params.lean;
  // The three edge vectors: A + B + C = 0.
  const ax = w - (s * c) / 2;
  const ay = -c / 2;
  const bx = -w - (s * c) / 2;
  const by = -c / 2;
  const cx = s * c;
  const cy = c;
  const ox = W / 2;
  const oy = H / 2;
  const sx = (2 * w) / SQ3;
  const gap = 1.1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // Back to the regular lattice, where the hexagon centres sit on a plain grid.
      const yr = (py - oy) / c;
      const xr = (px - ox - s * (py - oy)) / sx;
      const q = xr / SQ3 - yr / 3;
      const r = (2 / 3) * yr;
      // Round the axial coordinates to the nearest hexagon.
      let rq = Math.round(q);
      let rr = Math.round(r);
      const rs = Math.round(-q - r);
      const dq = Math.abs(rq - q);
      const dr = Math.abs(rr - r);
      const ds = Math.abs(rs + q + r);
      if (dq > dr && dq > ds) rq = -rr - rs;
      else if (dr > ds) rr = -rq - rs;
      const hx = SQ3 * (rq + rr / 2);
      const hy = 1.5 * rr;
      const ddx = xr - hx;
      const ddy = yr - hy;
      // Which of the three rhombi: top, left or right.
      const face = ddy < -Math.abs(ddx) / SQ3 ? 0 : ddx < 0 ? 1 : 2;
      const scx = ox + sx * hx + s * c * hy;
      const scy = oy + c * hy;
      const v = params.quad;
      v[0] = scx;
      v[1] = scy;
      if (face === 0) {
        v[2] = scx + ax; v[3] = scy + ay; v[4] = scx - cx; v[5] = scy - cy; v[6] = scx + bx; v[7] = scy + by;
      } else if (face === 1) {
        v[2] = scx + bx; v[3] = scy + by; v[4] = scx - ax; v[5] = scy - ay; v[6] = scx + cx; v[7] = scy + cy;
      } else {
        v[2] = scx + cx; v[3] = scy + cy; v[4] = scx - bx; v[5] = scy - by; v[6] = scx + ax; v[7] = scy + ay;
      }
      const d = inside(px, py, v);
      // A dark seam along every edge, softened over one LED.
      let k = (d - gap / 2) / 1.0 + 0.5;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const col = params.faces[face];
      display.setPixel(x, y, col[0] * k, col[1] * k, col[2] * k);
    }
  }
}
