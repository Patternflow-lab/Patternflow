// ===== Patternflow pattern =====
// Title:   Eccentric
// Family:  geometry
// Idea:    One ring stands on a bare dark ground with its hole pushed off the middle, so one side of the wall is thick and the other thin, and the ring's size, how far the hole is pushed and which way are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 145
// Round:   147
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Shift=-2..1, Turn=0..1
//
// Knob 1: Hue. The colour of the ring, turned round the wheel.
// Knob 2: Size. How wide the outside circle is, from 28 LEDs at the left to 60 at the right; the knob's 2 is 49. The hole is always 0.45 of it.
// Knob 3: Shift. How far the hole is pushed off the middle. At -1 it is dead centre; to the right it moves out the way the turn knob points until the thin side of the wall is 3 LEDs at 1, and to the left it crosses the middle to the far side, half as far at most. Its 0 is half the most it can go.
// Knob 4: Turn. Which way the hole is pushed, once round from straight up at the left and back to straight up at the right; its 0.06 is just right of up.

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
  params.r = 24;
  params.hole = 12;
  params.hx = 4;
  params.hy = -4;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  // The slow breath swells the ring and the hole a few percent and rocks the push a few degrees, so the thin side is never quite still.
  const r = ((28 + (32 * k[1]) / 3) / 2) * (1 + 0.03 * Math.sin(params.t * 0.47));
  const hole = 0.45 * r * (1 + 0.05 * Math.sin(params.t * 0.61 + 1));
  // The most the hole can be pushed leaves 3 LEDs of wall on the thin side.
  const most = r - hole - 3;
  // The push is a share of the most: 0 at the knob's -1, 1 at its 1, and -0.5 at its -2, which is the far side.
  const push = most * 0.5 * (k[2] + 1);
  const a = (360 * k[3] + 10 * Math.sin(params.t * 0.31 + 2)) * RAD;
  params.r = r;
  params.hole = hole;
  params.hx = push * Math.sin(a);
  params.hy = -push * Math.cos(a);
  // At 0 the hue knob would open on red; the ring starts on azure.
  hsv(k[0] + 0.58, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const r = params.r;
  const hole = params.hole;
  const hx = params.hx;
  const hy = params.hy;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // Inside the outside circle and outside the hole, whose middle is pushed off the panel's middle.
      const outer = Math.sqrt(dx * dx + dy * dy) - r;
      const ex = dx - hx;
      const ey = dy - hy;
      const inner = hole - Math.sqrt(ex * ex + ey * ey);
      const sd = outer > inner ? outer : inner;
      let m = 0.5 - sd;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      display.setPixel(x, y, col[0] * m, col[1] * m, col[2] * m);
    }
  }
}
