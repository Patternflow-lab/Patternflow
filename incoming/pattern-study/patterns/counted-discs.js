// ===== Patternflow pattern =====
// Title:   Counted Discs
// Family:  geometry
// Idea:    A disc of one radius sits on every point of a lattice and each LED takes its colour from how many discs cover it, so on a triangular lattice a radius equal to the spacing paints six-petalled rosettes, and the same discs on a square lattice paint a quilt of lenses.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the multiple covering of the plane by equal discs, whose thinnest single covering is the triangular lattice at radius spacing over root three (Richard Kershner, 1939, year from memory), original, pattern round 134
// Round:   134
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Radius=0..3.5, Spacing=-1..1, Skew=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. Each step in the count moves the hue on a little and every other count is dimmer.
// Knob 2: Radius. The radius of a disc as a share of the spacing, from 0.3 to 1.5. At 0.5 neighbours just touch, at 0.58 the triangular lattice is covered with no gap, at 1 each disc passes through the centres of its six neighbours (the knob's 2).
// Knob 3: Spacing. The distance between neighbouring lattice points, from 14.7 LEDs to 33; the middle is 22.
// Knob 4: Skew. The angle between the two lattice directions. At the left it is 60 degrees, a triangular lattice; at the right 90 degrees, a square one.

const W = 64;
const H = 128;
const PAL = 32;

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
  params.d = 22;
  params.r = 22;
  params.cos = 0.5;
  params.sin = Math.sqrt(0.75);
  params.pal = new Float32Array(PAL * 3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const d = 22 * Math.pow(1.5, k[2]);
  const ratio = (0.3 + 0.35 * k[1]) * (1 + 0.03 * Math.sin(t * 0.5));
  params.d = d;
  params.r = ratio * d;
  // The angle between the lattice's two directions runs from 60 to 90 degrees with the knob, and sways a little either side.
  const turn = Math.max(0, Math.min(1, k[3]));
  const theta = (60 + 30 * turn + 1.2 * Math.sin(t * 0.37 + 1)) * (Math.PI / 180);
  params.cos = Math.cos(theta);
  params.sin = Math.sin(theta);
  // A count of none is the dark ground; each count after it turns the hue on, and the odd counts are the bright ones.
  const pal = params.pal;
  hsv(k[0] + 0.62, 0.7, 0.07, pal, 0);
  for (let c = 1; c < PAL; c++) hsv(k[0] + 0.17 + 0.11 * c, 0.8, c % 2 === 1 ? 1 : 0.58, pal, c * 3);
}

export function draw(display, params, time) {
  const d = params.d;
  const r = params.r;
  const ca = params.cos;
  const sa = params.sin;
  const pal = params.pal;
  const reach = r + 0.5;
  const rowStep = d * sa;
  const slant = d * ca;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5 - H / 2;
    const jlo = Math.ceil((py - reach) / rowStep);
    const jhi = Math.floor((py + reach) / rowStep);
    for (let x = 0; x < W; x++) {
      const px = x + 0.5 - W / 2;
      let c = 0;
      for (let j = jlo; j <= jhi; j++) {
        const dy = py - j * rowStep;
        const w2 = reach * reach - dy * dy;
        if (w2 <= 0) continue;
        const w = Math.sqrt(w2);
        const x0 = px - j * slant;
        const ilo = Math.ceil((x0 - w) / d);
        const ihi = Math.floor((x0 + w) / d);
        for (let i = ilo; i <= ihi; i++) {
          const dx = x0 - i * d;
          const cover = reach - Math.sqrt(dx * dx + dy * dy);
          c += cover <= 0 ? 0 : cover >= 1 ? 1 : cover;
        }
      }
      // A disc's edge is one LED of ramp, so the count between two whole numbers blends the two colours.
      if (c > PAL - 1.001) c = PAL - 1.001;
      const ci = Math.floor(c);
      const f = c - ci;
      const o = ci * 3;
      display.setPixel(
        x,
        y,
        pal[o] + (pal[o + 3] - pal[o]) * f,
        pal[o + 1] + (pal[o + 4] - pal[o + 1]) * f,
        pal[o + 2] + (pal[o + 5] - pal[o + 2]) * f
      );
    }
  }
}
