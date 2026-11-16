// ===== Patternflow pattern =====
// Title:   Tangent
// Family:  geometry
// Idea:    One disc and one straight line on a bare dark ground, and the four knobs are the colour, the disc's size, how far the line is from touching it and which way round the disc the line sits.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 147
// Round:   149
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Radius=0..4, Gap=-1..1, Side=-1..1
//
// Knob 1: Hue. The colour of the disc, all the way round the wheel. The line is the same colour turned almost white.
// Knob 2: Radius. The disc's radius, 6 LEDs at 0 to 22 LEDs at 4; its 2 is 14.
// Knob 3: Gap. How far the line is from the disc, in radii. At -1 the line runs through the middle of the disc, at 0 its near edge just touches the disc's edge, at 1 a whole radius of dark lies between them.
// Knob 4: Side. Where round the disc the line sits. It goes once all the way round the disc, so -1 and 1 are the same place, and the touching point travels with it.

const W = 64;
const H = 128;
const CX = W / 2;
const CY = H / 2;
// The line's width in LEDs.
const THICK = 3;

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
  params.disc = [20, 255, 160];
  params.line = [225, 255, 240];
  params.r = 14;
  params.nx = 0;
  params.ny = 1;
  params.off = 16;
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // At 0 the hue knob would open on red; the disc starts a little round the wheel, on green.
  hsv(k[0] + 0.38, 0.9, 1, params.disc);
  hsv(k[0] + 0.38, 0.16, 1, params.line);
  // The radius breathes a few percent on a slow clock and the line sways a couple of degrees on another, only so the edges are never quite still. The line keeps its gap in radii.
  const r = (6 + 4 * k[1]) * (1 + 0.07 * Math.sin(params.t * 0.47));
  params.r = r;
  // The direction from the middle of the disc to the line, at a right angle to it. At 0 it points down and a little to the right.
  const a = (70 + 180 * k[3]) * (Math.PI / 180) + 0.04 * Math.sin(params.t * 0.31);
  params.nx = Math.cos(a);
  params.ny = Math.sin(a);
  // How far the line's middle is from the disc's middle: the radius and half the line's width bring it to touching, and the knob adds a radius either way.
  let off = r + THICK / 2 + k[2] * r;
  // The panel reaches this far from its middle along that direction. The line stays 2 LEDs inside it.
  const reach = 32 * Math.abs(params.nx) + 64 * Math.abs(params.ny);
  const most = reach - THICK / 2 - 2;
  if (off > most) off = most;
  params.off = off;
}

export function draw(display, params, time) {
  const disc = params.disc;
  const line = params.line;
  const r = params.r;
  const nx = params.nx;
  const ny = params.ny;
  const off = params.off;
  const half = THICK / 2;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - CY;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - CX;
      let cd = 0.5 - (Math.sqrt(dx * dx + dy * dy) - r);
      cd = cd < 0 ? 0 : cd > 1 ? 1 : cd;
      let cl = 0.5 - (Math.abs(dx * nx + dy * ny - off) - half);
      cl = cl < 0 ? 0 : cl > 1 ? 1 : cl;
      // The line is drawn over the disc.
      const keep = 1 - cl;
      display.setPixel(
        x,
        y,
        disc[0] * cd * keep + line[0] * cl,
        disc[1] * cd * keep + line[1] * cl,
        disc[2] * cd * keep + line[2] * cl,
      );
    }
  }
}
