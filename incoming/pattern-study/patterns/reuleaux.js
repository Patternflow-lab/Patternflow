// ===== Patternflow pattern =====
// Title:   Reuleaux
// Family:  geometry
// Idea:    One triangle on a bare dark ground whose three sides bulge as circular arcs, and the four knobs are its colour, how far the sides bulge, its size and how far it is turned.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The Reuleaux triangle (Franz Reuleaux, 1876), three arcs each centred on the opposite corner; the knob runs the same shape from the straight triangle through it to the circle
// Round:   149
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Bulge=0..4, Size=-1..1, Turn=-1..1
//
// Knob 1: Hue. The colour of the shape, all the way round the wheel.
// Knob 2: Bulge. How far each side swells outward, slowly at first and faster toward the end. At 0 the sides are straight and it is a plain triangle, at 2 they bow a little, at 2.7 each is an arc centred on the opposite corner (the Reuleaux triangle), and at 4 the three arcs have joined into a circle.
// Knob 3: Size. The distance from the middle to each corner, 16 LEDs at -1 to 30 LEDs at 1; its 0 is 23.
// Knob 4: Turn. The shape turns about the middle through a third of a turn, 60 degrees either way, so at -1 and at 1 it is the same shape. At 0 a corner points up.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
const SQRT3 = Math.sqrt(3);
// How far a side swells at its middle, as a share of its length, when the three arcs have joined into the circle through the corners: that circle's radius is the distance from the middle to a corner, 1 / sqrt(3) of the side, and the arc's rise is half of it.
const ROUND = 0.5 / SQRT3;

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
  params.col = [150, 20, 255];
  // Each side is a disc's edge: the three centres and the one radius they share.
  params.ax = [CX, CX, CX];
  params.ay = [CY, CY, CY];
  params.rho = 100;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the shape starts a long way round the wheel, on violet.
  hsv(k[0] + 0.76, 0.88, 1, params.col);
  // The size breathes a few percent on a slow clock and the shape sways a couple of degrees on another, only so the edges are never quite still.
  const R = (23 + 7 * k[2]) * (1 + 0.07 * Math.sin(params.t * 0.47));
  const side = R * SQRT3;
  // The swell of a side at its middle, a length. It grows with the square of the knob, so the circle sits exactly at the end. It never reaches 0, so the radius below stays a number.
  const u = k[1] / 4;
  let h = ROUND * u * u * side;
  if (h < 0.01) h = 0.01;
  // The arc of radius rho that stands on a chord of length side and rises h above it.
  const rho = (side * side) / (8 * h) + h / 2;
  params.rho = rho;
  const turn = k[3] * (Math.PI / 3) + 0.07 * Math.sin(params.t * 0.31);
  for (let i = 0; i < 3; i++) {
    // Corner i, then the side facing away from it, whose outward direction is the corner's opposite.
    const a = turn - Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const nx = -Math.cos(a);
    const ny = -Math.sin(a);
    // The side's chord is R / 2 from the middle. Its arc peaks h further out, and the arc's centre is rho back from that.
    const back = R / 2 + h - rho;
    params.ax[i] = CX + nx * back;
    params.ay[i] = CY + ny * back;
  }
}

export function draw(display, params, time) {
  const col = params.col;
  const rho = params.rho;
  const ax = params.ax;
  const ay = params.ay;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      // The shape is the three discs where they all overlap, so a point's signed distance is the largest of its three.
      let sd = -1e9;
      for (let i = 0; i < 3; i++) {
        const dx = px - ax[i];
        const dy = py - ay[i];
        const d = Math.sqrt(dx * dx + dy * dy) - rho;
        if (d > sd) sd = d;
      }
      const cov = 0.5 - sd;
      if (cov <= 0) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const m = cov > 1 ? 1 : cov;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
