// ===== Patternflow pattern =====
// Title:   Split
// Family:  geometry
// Idea:    A disc is cut straight through its middle and the two halves are pulled apart, so one round shape stands in the middle of the dark with a slit through it, and its size, how wide the slit is and which way it runs are the knobs.
// Author:  patternflow-lab
// Date:    2026-11-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: original, pattern round 146
// Round:   148
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Size=0..3, Gap=-1..1, Turn=0..1
//
// Knob 1: Hue. The colour of the two halves, turned round the wheel.
// Knob 2: Size. How wide the disc is before it is cut, from 22 LEDs at the left to 59 at the right; each step of the knob multiplies it by 1.39, and the knob's 2 is 42.7.
// Knob 3: Gap. How far apart the halves are pulled, from a 1.5 LED slit at the left to the widest gap that keeps both halves inside the panel at the right, which is the panel's 62 LEDs less the disc's width. A big disc has little room to open, so the same knob opens it less; its 0 is halfway.
// Knob 4: Turn. Which way the slit runs, half a turn from the left to the right of the knob. Turned half way round the two halves have changed places, so the two ends of the knob are the same picture; the knob's 0.06 is 21.6 degrees right of straight up.

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
  params.r = 21.4;
  params.half = 5;
  params.sn = 0.37;
  params.cs = 0.93;
  params.col = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swells the disc, opens and closes the slit a little and rocks it, so the two halves are never quite still.
  const d = 22 * Math.exp(0.33 * k[1]) * (1 + 0.04 * Math.sin(t * 0.47));
  // The halves may open until the pair is as wide as the panel, 62 LEDs, with the slit running straight up; a wider disc has less room.
  const room = 62 - d;
  let gap = 1.5 + (room - 1.5) * (0.5 + 0.5 * k[2]);
  gap *= 1 + 0.12 * Math.sin(t * 0.37 + 1);
  gap = gap < 1.2 ? 1.2 : gap > room ? room : gap;
  params.r = d / 2;
  params.half = gap / 2;
  const turn = (180 * (k[3] + 0.06) + 5 * Math.sin(t * 0.31 + 2)) * RAD;
  // The slit runs along (sn, -cs) and the halves move apart along (cs, sn).
  params.sn = Math.sin(turn);
  params.cs = Math.cos(turn);
  // At 0 the hue knob would open on red; the halves start on aqua.
  hsv(k[0] + 0.45, 0.8, 1, params.col, 0);
}

export function draw(display, params, time) {
  const r = params.r;
  const half = params.half;
  const sn = params.sn;
  const cs = params.cs;
  const col = params.col;
  for (let y = 0; y < H; y++) {
    const dy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      // u runs along the slit and v across it, from the middle of the panel.
      const u = dx * sn - dy * cs;
      const v = dx * cs + dy * sn;
      // Each half is half a disc centred on its own flat side, half a gap out from the middle. Inside the disc and on the right side of the slit is inside the half, and the farther of the two edges is the edge.
      const au = u < 0 ? -u : u;
      const av = (v < 0 ? -v : v) - half;
      const ring = Math.sqrt(au * au + av * av) - r;
      const side = -av;
      const sd = ring > side ? ring : side;
      let c = 0.5 - sd;
      c = c < 0 ? 0 : c > 1 ? 1 : c;
      display.setPixel(x, y, col[0] * c, col[1] * c, col[2] * c);
    }
  }
}
