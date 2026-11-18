// ===== Patternflow pattern =====
// Title:   Folded Bars
// Family:  geometry
// Idea:    One tilted bar, light at its head and dim at its tail, is reflected in the mirror lines of a rectangular lattice, so a single tilt and a single place make zigzags, diamonds and crossed bars that the mirrors repeat across the whole panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the wallpaper group pmm, a motif repeated by mirrors in two directions and by the translations they make (Evgraf Fedorov, 1891; George Pólya, 1924), original, pattern round 135
// Round:   135
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cell=0..3, Tilt=-1..1, Place=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. A bar's head is a little further round the wheel than its tail.
// Knob 2: Cell. How far apart the mirror lines are, from 8 LEDs to 26; the knob's 2 is 20. The bar grows with the cell, so the picture keeps its shape and only the number of repeats changes.
// Knob 3: Tilt. The angle of the bar against the horizontal mirror lines, from flat at the left through 40 degrees in the middle to 80 degrees at the right. Where the bar's mirror image meets it, the two make a V, an X or a diamond depending on the angle.
// Knob 4: Place. Where the bar's centre stands between the two vertical mirror lines of its cell. At the left it sits on the mirror line and meets its own image as an X; in the middle it sits halfway, and the bar runs from one mirror to the next as one stroke of a zigzag; at the right it sits on the other mirror line.

const W = 64;
const H = 128;

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
  params.cell = 20;
  params.cos = 1;
  params.sin = 0;
  params.cu = 10;
  params.hue = 0;
  params.rgb = new Float32Array(3);
  params.mirror = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swings the tilt a degree or two, widens the cell a little and slides the bar along its mirrors.
  params.cell = (8 + 6 * k[1]) * (1 + 0.025 * Math.sin(t * 0.41));
  const tilt = ((40 + 40 * k[2]) * Math.PI) / 180 + 0.026 * Math.sin(t * 0.33 + 1);
  params.cos = Math.cos(tilt);
  params.sin = Math.sin(tilt);
  const place = 0.5 + 0.5 * k[3] + 0.02 * Math.sin(t * 0.27 + 3);
  params.cu = params.cell * place;
  params.hue = k[0];
  hsv(k[0] + 0.62, 0.7, 0.2, params.mirror, 0);
}

export function draw(display, params, time) {
  const D = params.cell;
  const D2 = 2 * D;
  const cu = params.cu;
  const cv = D / 2;
  const hl = 0.68 * D;
  const ht = 0.16 * D;
  const co = params.cos;
  const si = params.sin;
  const hue = params.hue;
  const rgb = params.rgb;
  const mir = params.mirror;
  for (let y = 0; y < H; y++) {
    const zv = y + 0.5 - H / 2;
    let mv = zv % D2;
    if (mv < 0) mv += D2;
    const v = mv < D ? mv : D2 - mv;
    for (let x = 0; x < W; x++) {
      const zu = x + 0.5 - W / 2;
      let mu = zu % D2;
      if (mu < 0) mu += D2;
      const u = mu < D ? mu : D2 - mu;
      // The bar and its eight images in the mirrors round this cell. The point is tested against the bar after each reflection.
      let best = 0;
      let bestT = 0;
      for (let a = 0; a < 3; a++) {
        const pu = a === 0 ? u : a === 1 ? -u : D2 - u;
        for (let b = 0; b < 3; b++) {
          const pv = b === 0 ? v : b === 1 ? -v : D2 - v;
          const dx = pu - cu;
          const dy = pv - cv;
          const along = dx * co + dy * si;
          const across = -dx * si + dy * co;
          let ca = ht + 0.5 - Math.abs(across);
          ca = ca < 0 ? 0 : ca > 1 ? 1 : ca;
          let cl = hl + 0.5 - Math.abs(along);
          cl = cl < 0 ? 0 : cl > 1 ? 1 : cl;
          const c = ca * cl;
          if (c > best) {
            best = c;
            bestT = along / hl;
          }
        }
      }
      // The mirror lines, a faint line where the folded cell ends.
      const e = Math.min(u, D - u, v, D - v);
      let m = 1 - e;
      m = m < 0 ? 0 : m > 1 ? 1 : m;
      let r = mir[0] * m;
      let g = mir[1] * m;
      let bl = mir[2] * m;
      if (best > 0) {
        const tt = bestT < -1 ? -1 : bestT > 1 ? 1 : bestT;
        const head = (tt + 1) * 0.5;
        hsv(hue + 0.5 + 0.08 * head, 0.8, 0.42 + 0.58 * head, rgb, 0);
        r += (rgb[0] - r) * best;
        g += (rgb[1] - g) * best;
        bl += (rgb[2] - bl) * best;
      }
      display.setPixel(x, y, r, g, bl);
    }
  }
}
