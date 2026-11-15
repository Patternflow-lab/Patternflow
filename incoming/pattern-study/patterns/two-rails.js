// ===== Patternflow pattern =====
// Title:   Two Rails
// Family:  line
// Idea:    Straight lines join evenly spaced marks on two edges of the panel, the first mark of one edge to the last of the other, and in each corner their crossings bend into a curve that no single line draws.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: curve stitching, whose lines envelope a parabola (Mary Everest Boole, late 19th century; the parabola from Apollonius, about 200 BC), pattern round 130
// Round:   130
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Lines=0.8..4.8, Shift=-1..1, Reach=0..0.2
//
// Knob 1: Hue. Turns the four corners round the colour wheel together.
// Knob 2: Lines. How many marks sit on each rail, 4 at the bottom of the knob and 24 at the top, so how fine the weave is.
// Knob 3: Shift. Slides the far end of every line along its rail, so the curves lean away from the corner they began in.
// Knob 4: Reach. How far along each edge a corner's lines go, from a third of it to all of it, where the four corners cross.

const W = 64;
const H = 128;

function hsv(h, s, v, out, o) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const k = i % 6;
  out[o] = (k === 0 || k === 5 ? v : k === 1 ? q : k === 4 ? t : p) * 255;
  out[o + 1] = (k === 1 || k === 2 ? v : k === 0 ? t : k === 3 ? q : p) * 255;
  out[o + 2] = (k === 3 || k === 4 ? v : k === 2 ? t : k === 5 ? q : p) * 255;
}

export function setup(params) {
  params.t = 0;
  params.buf = new Float32Array(W * H * 3);
  params.hue = 0.1;
  params.n = 10;
  params.shift = 0;
  params.reach = 0.5;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  params.hue = k[0] + 0.08;
  params.n = Math.max(4, Math.min(24, Math.round(k[1] * 5)));
  // The far ends drift along their rails a little, so the net never sits quite still.
  params.shift = k[2] * 0.6 + 0.05 * Math.sin(params.t * 0.45);
  params.reach = 0.3 + (k[3] / 0.2) * 0.7;
}

// A line of light, one LED wide, laid in by half-LED steps along its longer axis.
function line(buf, x0, y0, x1, y1, r, g, b) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const x = x0 + dx * u - 0.5;
    const y = y0 + dy * u - 0.5;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    for (let j = 0; j < 4; j++) {
      const px = ix + (j & 1);
      const py = iy + (j >> 1);
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const w = 0.5 * ((j & 1 ? fx : 1 - fx) * (j >> 1 ? fy : 1 - fy));
      const p = (py * W + px) * 3;
      buf[p] += r * w;
      buf[p + 1] += g * w;
      buf[p + 2] += b * w;
    }
  }
}

export function draw(display, params, time) {
  const buf = params.buf;
  buf.fill(0);
  const n = params.n;
  const reachX = params.reach * W;
  const reachY = params.reach * H;
  const col = [0, 0, 0];
  // Corners top left, top right, bottom right, bottom left: where each starts and which way is in.
  const ox = [0, W, W, 0];
  const oy = [0, 0, H, H];
  const ex = [1, -1, -1, 1];
  const ey = [1, 1, -1, -1];
  for (let c = 0; c < 4; c++) {
    for (let i = 1; i < n; i++) {
      const u = i / n;
      // The mark i of the side edge joins the mark n - i of the top edge, and a shift slides the second one.
      let v = 1 - u + params.shift;
      if (v < 0) v = 0;
      hsv(params.hue + c * 0.22 + u * 0.1, 0.9, 0.85, col, 0);
      line(buf, ox[c], oy[c] + ey[c] * u * reachY, ox[c] + ex[c] * v * reachX, oy[c], col[0], col[1], col[2]);
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 3;
      display.setPixel(x, y, Math.min(255, buf[p]), Math.min(255, buf[p + 1]), Math.min(255, buf[p + 2]));
    }
  }
}
