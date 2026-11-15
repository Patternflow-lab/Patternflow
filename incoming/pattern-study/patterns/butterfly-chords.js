// ===== Patternflow pattern =====
// Title:   Butterfly Chords
// Family:  geometry
// Idea:    Two chords cross at the middle of a third chord and their four ends are joined into two wings, and however the chords are tilted the wings cut that third chord at the same distance either side of its middle, which two bars underneath measure as always the same length.
// Author:  patternflow-lab
// Date:    2026-11-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the butterfly theorem, posed in The Gentleman's Diary in 1815, original, pattern round 138
// Round:   140
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Right=0..3, Left=-1..1, Depth=0..1
//
// Knob 1: Hue. Turns the colours round the wheel. The left wing and the bar under it take one colour and the right wing and its bar the colour opposite.
// Knob 2: Right. How steeply the chord that rises to the right through the middle point stands, from a flat 28 degrees at the left to 82 degrees at the right; the knob's 2 is 64 degrees. Steeper makes the wings thinner.
// Knob 3: Left. How steeply the chord that rises to the left stands, the same 28 to 82 degrees from flat; its 0 is 55 degrees.
// Knob 4: Depth. How far the third chord lies below the middle of the circle, from just under a fifth of the radius at the left to four fifths at the right. The deeper it lies the shorter that chord, and the bars under it are measured against its half length.

const W = 64;
const H = 128;
const CX = 32;
const CY = 50;
const R = 28.5;
const BX0 = 4;
const BX1 = 60;
const BY0 = 96;
const BY1 = 106;

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
  // The four ends of the two chords, the middle of the third chord and the two places the wings cut it.
  params.p = new Float32Array(8 + 2 + 2);
  params.my = CY + 10;
  params.h = 20;
  params.sx = 0;
  params.sy = 0;
  params.col = new Float32Array(3 * 5);
}

export function update(dt, input, params) {
  const k = input.knobValues || [0, 2, 0, 0.06];
  params.t += dt;
  const t = params.t;
  const deg = Math.PI / 180;
  // The slow breath tilts both chords a few degrees and rocks the third chord a little.
  const al = (28 + (54 * k[1]) / 3 + 3.2 * Math.sin(t * 0.47)) * deg;
  const be = Math.PI - (28 + (54 * (k[2] + 1)) / 2 + 3.6 * Math.sin(t * 0.39 + 1)) * deg;
  const d = R * Math.min(0.88, Math.max(0.1, 0.18 + 0.62 * k[3] + 0.03 * Math.sin(t * 0.31 + 2)));
  const my = CY + d;
  params.my = my;
  params.h = Math.sqrt(R * R - d * d);
  const p = params.p;
  // A and B are the ends of the chord with angle al, A above and B below the middle point M = (CX, my); D and C of the chord with angle be, in the same way.
  const ends = [al, be];
  for (let j = 0; j < 2; j++) {
    const ux = Math.cos(ends[j]);
    const uy = Math.sin(ends[j]);
    const s = Math.sqrt(R * R - d * d * ux * ux);
    const tp = -d * uy + s;
    const tm = -d * uy - s;
    // Above (tm) then below (tp).
    p[j * 4] = CX + tm * ux;
    p[j * 4 + 1] = my + tm * uy;
    p[j * 4 + 2] = CX + tp * ux;
    p[j * 4 + 3] = my + tp * uy;
  }
  // p: 0,1 = A (above, chord al)  2,3 = B (below, chord al)  4,5 = C (above, chord be)  6,7 = D (below, chord be)
  // The wing on the left is A M D, the one on the right is B M C. Each is cut by the third chord where line A-D and line B-C cross it.
  const lx = (p[0] + (p[6] - p[0]) * ((my - p[1]) / (p[7] - p[1]))) - CX;
  const rx = (p[2] + (p[4] - p[2]) * ((my - p[3]) / (p[5] - p[3]))) - CX;
  params.sx = lx;
  params.sy = rx;
  params.p[8] = CX + lx;
  params.p[9] = my;
  params.p[10] = CX + rx;
  params.p[11] = my;
  hsv(k[0] + 0.02, 0.82, 0.8, params.col, 0);
  hsv(k[0] + 0.52, 0.82, 0.8, params.col, 3);
  hsv(k[0] + 0.76, 0.7, 0.16, params.col, 6);
  hsv(k[0] + 0.02, 0.35, 1, params.col, 9);
  hsv(k[0] + 0.52, 0.35, 1, params.col, 12);
}

// Signed distance to a triangle, negative inside, taken as the largest of the signed distances to its three sides.
function triDist(px, py, ax, ay, bx, by, cx, cy) {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const sg = area > 0 ? 1 : -1;
  let m = -1e9;
  for (let e = 0; e < 3; e++) {
    const x0 = e === 0 ? ax : e === 1 ? bx : cx;
    const y0 = e === 0 ? ay : e === 1 ? by : cy;
    const x1 = e === 0 ? bx : e === 1 ? cx : ax;
    const y1 = e === 0 ? by : e === 1 ? cy : ay;
    const ex = x1 - x0;
    const ey = y1 - y0;
    const l = Math.sqrt(ex * ex + ey * ey) || 1;
    const s = (sg * (ex * (py - y0) - ey * (px - x0))) / l;
    // Positive is the outside of the triangle for this side.
    const dd = -s;
    if (dd > m) m = dd;
  }
  return m;
}

export function draw(display, params, time) {
  const p = params.p;
  const my = params.my;
  const h = params.h;
  const col = params.col;
  const ax = p[0];
  const ay = p[1];
  const bx = p[2];
  const by = p[3];
  const cx = p[4];
  const cy = p[5];
  const dx = p[6];
  const dy = p[7];
  const scale = (BX1 - BX0) / 2 / h;
  const lenL = Math.min(BX1 - BX0, Math.abs(params.sx) * scale);
  const lenR = Math.min(BX1 - BX0, Math.abs(params.sy) * scale);
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 0;
      let g = 0;
      let b = 0;
      if (py >= BY0 - 2 && py < BY1 + 2) {
        // The measure under the circle: the third chord drawn straight, with the two lengths the wings cut from it laid out from its middle.
        const mid = CX;
        if (py >= BY0 + 2 && py < BY1 - 2) {
          if (px >= mid - lenL && px < mid) {
            r = col[0];
            g = col[1];
            b = col[2];
            const e = Math.min(px - (mid - lenL), 1);
            if (e < 1) {
              const m = 0.3 + 0.7 * e;
              r *= m;
              g *= m;
              b *= m;
            }
          } else if (px >= mid && px < mid + lenR) {
            r = col[3];
            g = col[4];
            b = col[5];
            const e = Math.min(mid + lenR - px, 1);
            if (e < 1) {
              const m = 0.3 + 0.7 * e;
              r *= m;
              g *= m;
              b *= m;
            }
          }
        }
        // A rule that runs the whole half length of the chord, and a tick at its middle.
        if (
          (py >= BY1 + 1 && py < BY1 + 2 && px >= BX0 && px < BX1) ||
          (py >= BY0 - 2 && py < BY1 + 2 && ((px >= BX0 && px < BX0 + 1) || (px >= BX1 - 1 && px < BX1))) ||
          ((py < BY0 + 2 || py >= BY1 - 2) && py >= BY0 - 2 && py < BY1 + 2 && px >= mid - 1 && px < mid + 1)
        ) {
          r = 150;
          g = 150;
          b = 162;
        }
      } else {
        const ox = px - CX;
        const oy = py - CY;
        const rr = Math.sqrt(ox * ox + oy * oy);
        let c = R + 0.5 - rr;
        if (c > 0) {
          if (c > 1) c = 1;
          // The disc, dark, with its edge lit.
          let e = 1 - Math.abs(rr - R + 0.4);
          if (e < 0) e = 0;
          // The part of the disc under the third chord is a little lighter, so Depth moves a field and not only a line.
          const cap = py > my ? 1.7 : 1;
          r = col[6] * cap + (150 - col[6] * cap) * e * 0.9;
          g = col[7] * cap + (150 - col[7] * cap) * e * 0.9;
          b = col[8] * cap + (165 - col[8] * cap) * e * 0.9;
          // The two wings.
          const dl = triDist(px, py, ax, ay, CX, my, dx, dy);
          const dr = triDist(px, py, bx, by, CX, my, cx, cy);
          let wl = 0.5 - dl;
          wl = wl < 0 ? 0 : wl > 1 ? 1 : wl;
          let wr = 0.5 - dr;
          wr = wr < 0 ? 0 : wr > 1 ? 1 : wr;
          if (wl > 0) {
            const m = 0.5 + 0.5 * Math.min(1, -dl / 3);
            const el = 1 - Math.min(1, Math.abs(dl + 0.2));
            r += (col[0] * (m > 0.5 ? m : 0.5) - r) * wl;
            g += (col[1] * (m > 0.5 ? m : 0.5) - g) * wl;
            b += (col[2] * (m > 0.5 ? m : 0.5) - b) * wl;
            if (el > 0) {
              r += (col[9] - r) * el * 0.55;
              g += (col[10] - g) * el * 0.55;
              b += (col[11] - b) * el * 0.55;
            }
          }
          if (wr > 0) {
            const m = 0.5 + 0.5 * Math.min(1, -dr / 3);
            r += (col[3] * (m > 0.5 ? m : 0.5) - r) * wr;
            g += (col[4] * (m > 0.5 ? m : 0.5) - g) * wr;
            b += (col[5] * (m > 0.5 ? m : 0.5) - b) * wr;
            const er = 1 - Math.min(1, Math.abs(dr + 0.2));
            if (er > 0) {
              r += (col[12] - r) * er * 0.55;
              g += (col[13] - g) * er * 0.55;
              b += (col[14] - b) * er * 0.55;
            }
          }
          // The third chord, thin and pale, across the whole circle.
          let best = 0;
          const half = params.h;
          const ex = Math.abs(ox) - half;
          if (ex < 0.5) {
            const cc = 1.1 - Math.abs(py - my);
            if (cc > best) best = cc;
          }
          // The two parts of it the wings cut, thicker and in the wings' own light.
          const mx = ox;
          let thick = 0;
          let which = 0;
          if (Math.abs(py - my) < 1.6 && mx <= 0 && mx >= params.sx - 0.5) {
            thick = 1.6 - Math.abs(py - my);
            which = 0;
          } else if (Math.abs(py - my) < 1.6 && mx >= 0 && mx <= params.sy + 0.5) {
            thick = 1.6 - Math.abs(py - my);
            which = 1;
          }
          if (thick > 0) {
            if (thick > 1) thick = 1;
            r += ((which === 0 ? col[9] : col[12]) - r) * thick;
            g += ((which === 0 ? col[10] : col[13]) - g) * thick;
            b += ((which === 0 ? col[11] : col[14]) - b) * thick;
          } else if (best > 0) {
            if (best > 1) best = 1;
            r += (225 - r) * best * 0.7;
            g += (225 - g) * best * 0.7;
            b += (235 - b) * best * 0.7;
          }
          // The middle point and the two cut points.
          const dm = 2.6 - Math.sqrt(ox * ox + (py - my) * (py - my));
          const d1 = 2.2 - Math.sqrt((px - (CX + params.sx)) * (px - (CX + params.sx)) + (py - my) * (py - my));
          const d2 = 2.2 - Math.sqrt((px - (CX + params.sy)) * (px - (CX + params.sy)) + (py - my) * (py - my));
          let dot = Math.max(dm, d1, d2);
          if (dot > 0) {
            if (dot > 1) dot = 1;
            r += (255 - r) * dot;
            g += (248 - g) * dot;
            b += (238 - b) * dot;
          }
          r *= c;
          g *= c;
          b *= c;
        }
      }
      display.setPixel(x, y, r, g, b);
    }
  }
}
