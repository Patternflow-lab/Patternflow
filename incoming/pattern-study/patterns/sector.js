// ===== Patternflow pattern =====
// Title:   Sector
// Family:  geometry
// Idea:    One slice of a disc turns about a point in the middle of the dark, and its reach, how wide it opens and which way it points are the knobs, with nothing else on the panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 140
// Round:   142
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Reach=0..3, Opening=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the slice, turned round the wheel.
// Knob 2: Reach. How far the slice runs from its point, from 8 LEDs at the left to 31 at the right, which is as far as the panel is wide; the knob's 2 is 23.
// Knob 3: Opening. How wide the slice opens, from a narrow 30 degrees at the left, through 135 in the middle, to 240 at the right.
// Knob 4: Turn. Which way the slice points, once round from straight up at the left and back to straight up at the right; its 0.06 is just right of up.

const W = 64;
const H = 128;
const RAD = Math.PI / 180;

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
  params.r = 23;
  params.sh = Math.sin(75 * RAD);
  params.ch = Math.cos(75 * RAD);
  params.bx = 0;
  params.by = -1;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the slice a few percent, opens and closes it a few degrees and rocks it about its point.
  const reach = (8 + (23 * k[1]) / 3) * (1 + 0.07 * Math.sin(t * 0.47));
  params.r = reach > 31.5 ? 31.5 : reach;
  const open = (135 + 105 * k[2] + 8 * Math.sin(t * 0.37 + 1)) * RAD;
  params.sh = Math.sin(open / 2);
  params.ch = Math.cos(open / 2);
  // The way the slice points, turned clockwise from straight up.
  const a = (360 * k[3] + 6 * Math.sin(t * 0.31 + 2)) * RAD;
  params.bx = Math.sin(a);
  params.by = -Math.cos(a);
  hsv(k[0] + 0.04, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const r = params.r;
  const sh = params.sh;
  const ch = params.ch;
  const bx = params.bx;
  const by = params.by;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // The LED in the slice's own frame: along the way it points, and out to either side of it.
      const along = dx * bx + dy * by;
      const out = Math.abs(-dx * by + dy * bx);
      // The signed distance to a slice that opens by twice the half angle, negative inside.
      const len = Math.sqrt(along * along + out * out);
      const l = len - r;
      let proj = out * sh + along * ch;
      proj = proj < 0 ? 0 : proj > r ? r : proj;
      const ex = out - sh * proj;
      const ey = along - ch * proj;
      const m0 = Math.sqrt(ex * ex + ey * ey);
      const side = ch * out - sh * along >= 0 ? 1 : -1;
      const sd = Math.max(l, m0 * side);
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
