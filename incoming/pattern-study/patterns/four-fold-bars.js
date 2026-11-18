// ===== Patternflow pattern =====
// Title:   Four Fold Bars
// Family:  geometry
// Idea:    One tilted bar is turned by quarter turns about the corners of a square lattice and by the translations those turns make, each of the four turns in a colour of its own, so a single tilt and a single place make pinwheels, crosses and square frames that the turns repeat across the whole panel.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the wallpaper group p4, a motif repeated by quarter turns about two kinds of centre and by the translations they make (Evgraf Fedorov, 1891; George Pólya, 1924), original, pattern round 136
// Round:   136
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Cell=0..3, Tilt=-1..1, Place=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel. The four turns of the bar are four steps round it, and a bar's head is lighter than its tail.
// Knob 2: Cell. How far apart the turning points are, from 10 LEDs to 31; the knob's 2 is 24. The bar grows with the cell, so the picture keeps its shape and only the number of repeats changes.
// Knob 3: Tilt. The angle of the bar, a half turn of the compass in all, from 45 degrees at the left through 135 degrees in the middle to 225 degrees at the right. At 135 the bar lies across the line it stands on, and the four turns of it close into a square frame; away from 135 each bar turns on its own place and the frame opens into a pinwheel.
// Knob 4: Place. Where the bar stands on the diagonal between the two kinds of turning point. At the left its middle sits on a turning point and the four turns of it cross there; a little short of halfway the bars close into frames round both kinds of point; at the right it sits on the other kind of turning point and the cross is there.

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
  params.cell = 24;
  params.cx = new Float32Array(4);
  params.cy = new Float32Array(4);
  params.dx = new Float32Array(4);
  params.dy = new Float32Array(4);
  params.hue = 0;
  params.rgb = new Float32Array(3);
  params.back = new Float32Array(3);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  // The slow breath swings the tilt a degree or two, widens the cell a little and slides the bar along its line.
  const D = (10 + 7 * k[1]) * (1 + 0.02 * Math.sin(t * 0.41));
  params.cell = D;
  // The tilt opens across the diagonal the bar slides along, so its four turns close into square frames, and the place is bent a little so the frames open a little short of halfway.
  const phi = ((135 + 90 * k[2]) * Math.PI) / 180 + 0.03 * Math.sin(t * 0.33 + 1);
  const place = Math.pow(0.5 + 0.5 * k[3], 1.2) + 0.02 * Math.sin(t * 0.27 + 3);
  const mx = place * D * 0.5;
  // The bar's middle and its direction after 0, 1, 2 and 3 quarter turns about the lattice point.
  for (let q = 0; q < 4; q++) {
    const c = Math.cos(phi + (q * Math.PI) / 2);
    const s = Math.sin(phi + (q * Math.PI) / 2);
    params.dx[q] = c;
    params.dy[q] = s;
    params.cx[q] = q === 0 ? mx : q === 1 ? -mx : q === 2 ? -mx : mx;
    params.cy[q] = q === 0 ? mx : q === 1 ? mx : q === 2 ? -mx : -mx;
  }
  params.hue = k[0];
  hsv(k[0] + 0.62, 0.7, 0.09, params.back, 0);
}

export function draw(display, params, time) {
  const D = params.cell;
  const hl = 0.36 * D;
  const ht = 0.09 * D;
  const hue = params.hue;
  const cx = params.cx;
  const cy = params.cy;
  const dx = params.dx;
  const dy = params.dy;
  const rgb = params.rgb;
  const back = params.back;
  for (let y = 0; y < H; y++) {
    const zy = y + 0.5 - H / 2;
    for (let x = 0; x < W; x++) {
      const zx = x + 0.5 - W / 2;
      let best = 0;
      let bestT = 0;
      let bestQ = 0;
      for (let q = 0; q < 4; q++) {
        // A turn of the bar sits at its middle plus every whole cell. The nearest two cells either way are the only ones in reach.
        const ux = zx - cx[q];
        const uy = zy - cy[q];
        const fx = Math.floor(ux / D);
        const fy = Math.floor(uy / D);
        for (let a = 0; a < 2; a++) {
          const ex = ux - (fx + a) * D;
          for (let b = 0; b < 2; b++) {
            const ey = uy - (fy + b) * D;
            const along = ex * dx[q] + ey * dy[q];
            const across = -ex * dy[q] + ey * dx[q];
            let ca = ht + 0.5 - Math.abs(across);
            ca = ca < 0 ? 0 : ca > 1 ? 1 : ca;
            let cl = hl + 0.5 - Math.abs(along);
            cl = cl < 0 ? 0 : cl > 1 ? 1 : cl;
            const c = ca * cl;
            if (c > best) {
              best = c;
              bestT = along / hl;
              bestQ = q;
            }
          }
        }
      }
      let r = back[0];
      let g = back[1];
      let bl = back[2];
      if (best > 0) {
        const tt = bestT < -1 ? -1 : bestT > 1 ? 1 : bestT;
        const head = (tt + 1) * 0.5;
        hsv(hue + 0.5 + 0.17 * bestQ, 0.8, 0.45 + 0.55 * head, rgb, 0);
        r += (rgb[0] - r) * best;
        g += (rgb[1] - g) * best;
        bl += (rgb[2] - bl) * best;
      }
      display.setPixel(x, y, r, g, bl);
    }
  }
}
