// ===== Patternflow pattern =====
// Title:   Ptolemy Split
// Family:  geometry
// Idea:    Put four points on a circle and the two diagonals of the quadrilateral they make multiply to exactly the two pairs of opposite sides multiplied and added, so a rectangle as wide and tall as the diagonals splits into two rectangles with those areas and has nothing left over, however you move the points.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Ptolemy's theorem on the diagonals of a cyclic quadrilateral (Claudius Ptolemy, about 150 CE, in the Almagest), original, pattern round 139
// Round:   139
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, First=0..3, Second=-1..1, Third=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The two pairs of opposite sides take two colours half a wheel apart, and the rectangle below takes the same two.
// Knob 2: First. How wide the arc of the circle between the first two points is, against the other three arcs, which share what is left. At its start the arc is a third of the circle.
// Knob 3: Second. The same for the second arc, from the second point to the third. Turned down, the second and third points crowd together; turned up, they open out.
// Knob 4: Third. The same for the third arc. The fourth arc is the one nothing turns; it stays what the other three leave it.

const W = 64;
const H = 128;
// The circle, in LEDs, and where it stands.
const CX = 32;
const CY = 31;
const R = 24;
// The rectangle is as wide and tall as the diagonals, drawn S times larger, so that two diagonals of a whole diameter just fill 56 LEDs.
const S = 56 / (2 * R);
const RX = 32;
const RY = 94;

function hsv(h, s, v, out, at) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[at] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[at + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[at + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  // The four points on the circle, in order round it.
  params.px = new Float32Array(4);
  params.py = new Float32Array(4);
  // The rectangle: left, right, top, bottom, and the heights of the two pieces.
  params.rc = new Float32Array(6);
  params.col = new Float32Array(15);
  params.len = new Float32Array(6);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // Three arcs are weighed against a fourth that stays 1, so turning one knob widens its arc and the others give way together.
  // The slow breath moves each weight a few percent and turns the whole ring a little.
  const w = [
    (0.45 + 0.8 * k[1]) * (1 + 0.06 * Math.sin(t * 0.41 + 0.3)),
    Math.max(0.2, 1.6 + 1.3 * k[2]) * (1 + 0.06 * Math.sin(t * 0.33 + 1.7)),
    Math.max(0.2, 1.5 + 1.2 * (k[3] - 0.06)) * (1 + 0.06 * Math.sin(t * 0.29 + 2.9)),
    1,
  ];
  const total = w[0] + w[1] + w[2] + w[3];
  let a = -1.9 + 0.12 * Math.sin(t * 0.37 + 1);
  const px = params.px;
  const py = params.py;
  for (let i = 0; i < 4; i++) {
    px[i] = CX + R * Math.cos(a);
    py[i] = CY + R * Math.sin(a);
    a += (6.283185307 * w[i]) / total;
  }
  // The four sides, then the two diagonals.
  const len = params.len;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    len[i] = Math.hypot(px[j] - px[i], py[j] - py[i]);
  }
  len[4] = Math.hypot(px[2] - px[0], py[2] - py[0]);
  len[5] = Math.hypot(px[3] - px[1], py[3] - py[1]);
  // The rectangle is len[4] by len[5]. The two pieces are cut from it by their areas alone, the opposite sides multiplied in pairs,
  // each taken over the width. The pieces are placed one on the other from the bottom; that they end flush with the top is Ptolemy.
  const rw = len[4] * S;
  const rh = len[5] * S;
  const rc = params.rc;
  rc[0] = RX - rw * 0.5;
  rc[1] = RX + rw * 0.5;
  rc[2] = RY - rh * 0.5;
  rc[3] = RY + rh * 0.5;
  rc[4] = (len[0] * len[2] * S) / Math.max(0.001, len[4]);
  rc[5] = (len[1] * len[3] * S) / Math.max(0.001, len[4]);
  const col = params.col;
  hsv(k[0] + 0.03, 0.72, 0.92, col, 0);
  hsv(k[0] + 0.53, 0.7, 0.92, col, 3);
  hsv(k[0] + 0.03, 0.72, 0.8, col, 6);
  hsv(k[0] + 0.53, 0.7, 0.8, col, 9);
  hsv(k[0] + 0.62, 0.35, 0.33, col, 12);
}

function seg(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  let u = ((x - ax) * dx + (y - ay) * dy) / Math.max(0.0001, dx * dx + dy * dy);
  if (u < 0) u = 0;
  else if (u > 1) u = 1;
  const ex = x - (ax + dx * u);
  const ey = y - (ay + dy * u);
  return Math.sqrt(ex * ex + ey * ey);
}

export function draw(display, params, time) {
  const px = params.px;
  const py = params.py;
  const rc = params.rc;
  const col = params.col;
  const x0 = rc[0];
  const x1 = rc[1];
  const y0 = rc[2];
  const y1 = rc[3];
  // Piece one, the first and third sides, from the bottom; piece two on top of it.
  const cut1 = y1 - rc[4];
  const cut2 = cut1 - rc[5];
  for (let y = 0; y < H; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < W; x++) {
      const xx = x + 0.5;
      let r = 3;
      let g = 3;
      let b = 8;
      // The circle, thin and dim.
      const dc = Math.abs(Math.hypot(xx - CX, yy - CY) - R);
      let cc = 1.1 - dc;
      if (cc > 0) {
        if (cc > 1) cc = 1;
        r += (col[12] - r) * cc;
        g += (col[13] - g) * cc;
        b += (col[14] - b) * cc;
      }
      // The two pieces of the rectangle, each by how much of the LED it covers.
      let hc = Math.min(xx + 0.5, x1) - Math.max(xx - 0.5, x0);
      if (hc > 0) {
        if (hc > 1) hc = 1;
        let v1 = Math.min(yy + 0.5, y1) - Math.max(yy - 0.5, cut1);
        let v2 = Math.min(yy + 0.5, cut1) - Math.max(yy - 0.5, cut2);
        if (v1 > 0) {
          if (v1 > 1) v1 = 1;
          const cv = v1 * hc;
          r += (col[6] - r) * cv;
          g += (col[7] - g) * cv;
          b += (col[8] - b) * cv;
        }
        if (v2 > 0) {
          if (v2 > 1) v2 = 1;
          const cv = v2 * hc;
          r += (col[9] - r) * cv;
          g += (col[10] - g) * cv;
          b += (col[11] - b) * cv;
        }
      }
      // The sides of the quadrilateral: the first and third in one colour, the second and fourth in the other.
      let best = 99;
      let which = 0;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const d = seg(xx, yy, px[i], py[i], px[j], py[j]);
        if (d < best) {
          best = d;
          which = i & 1;
        }
      }
      let cs = 1.7 - best;
      if (cs > 0) {
        if (cs > 1) cs = 1;
        const o = which * 3;
        r += (col[o] - r) * cs;
        g += (col[o + 1] - g) * cs;
        b += (col[o + 2] - b) * cs;
      }
      // The two diagonals, thin and white.
      const dd = Math.min(seg(xx, yy, px[0], py[0], px[2], py[2]), seg(xx, yy, px[1], py[1], px[3], py[3]));
      let cw = 1.0 - dd;
      // The rectangle's own outline is white too, where the diagonals are its width and height.
      const dl = Math.min(
        seg(xx, yy, x0, y0, x1, y0),
        seg(xx, yy, x0, y1, x1, y1),
        seg(xx, yy, x0, y0, x0, y1),
        seg(xx, yy, x1, y0, x1, y1),
      );
      const co = 1.0 - dl;
      if (co > cw) cw = co;
      if (cw > 0) {
        if (cw > 1) cw = 1;
        r += (245 - r) * cw;
        g += (242 - g) * cw;
        b += (232 - b) * cw;
      }
      // The four points.
      for (let i = 0; i < 4; i++) {
        const ex = xx - px[i];
        const ey = yy - py[i];
        const q = ex * ex + ey * ey;
        if (q < 9) {
          let cd = 2.5 - Math.sqrt(q);
          if (cd > 1) cd = 1;
          if (cd > 0) {
            r += (255 - r) * cd;
            g += (250 - g) * cd;
            b += (240 - b) * cd;
          }
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
