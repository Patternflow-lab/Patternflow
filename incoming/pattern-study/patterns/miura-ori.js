// ===== Patternflow pattern =====
// Title:   Miura-ori
// Family:  space
// Idea:    A Miura-ori sheet of congruent parallelograms, bigger than the panel, folds and opens again on its one degree of freedom, seen in 3D from a little below, so its facets split into four kinds that flip between a warm key light, a cool fill, both and neither as the fold deepens, its mountain and valley creases show as light and dark lines, and at the deepest fold the sheet has shrunk across and down at once until its edges come into view on all four sides.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Miura-ori (Koryo Miura, 1970; "Method of packaging and deployment of large membranes in space", 1985), its closed-form rigid folding and in-plane Poisson ratio (Mark Schenk and Simon Guest, 2013), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sector=55..85, Light=0..1
//
// Knob 1: Hue. The colour of the two lights, which keep opposite hues. At 0 the key is amber and the fill blue, so a facet that faces both is cream, one that faces only the key amber, only the fill blue, and neither almost black; at 0.5 the key is sky blue and the fill salmon.
// Knob 2: Speed. At 2 the sheet folds from almost flat to its deepest fold in 4 s and opens again in 4 s; 40 s each way at 0.2 and 2.7 s at 3.
// Knob 3: Sector. The sector angle alpha, the acute angle between each parallelogram's 12 and 10 LED sides, from 55 to 85 degrees. At 55 the deepest fold shrinks the sheet to 57% across and 67% down, and halfway there it shrinks 0.66% across for every 1% down. At 70 it goes to 78% and 52%. At 85 the facets are nearly rectangles, the sheet only shortens, to 51%, and the creases run as straight bands.
// Knob 4: Light. Walks both lights once round the sheet. The key stands 45 degrees up and the fill 15 degrees up a quarter turn round from it; at 0.06 the key comes from the top of the panel and the fill from its right.

const W = 64, H = 128, SW = 128, SH = 256, NS = SW * SH;
const { floor, ceil, round, sqrt, cos, sin, acos, min, max, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = PI / 180;

function hsv(h, s, v, o, k) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[k] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[k + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[k + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// ---- The fold. A Miura-ori is a translational surface, P(i, j) = A(i) + B(j),
// with A a zigzag in the (v, z) plane whose steps are
//   eb(i) = (0, b cos psi, +-b sin psi)
// and B a zigzag in the (u, v) plane whose steps are
//   ea(j) = (a sin g, +-a cos g, 0).
// Every facet is then a parallelogram with sides eb(i) and ea(j), so its
// sides stay b and a whatever psi is, and its angle stays alpha (or pi -
// alpha, the same parallelogram turned over) while eb.ea = +-ab cos alpha,
// that is cos psi cos g = cos alpha. psi = 0 is the flat sheet (g = alpha)
// and psi = alpha the sheet folded flat into a packet (g = 0); psi is the
// fold's one degree of freedom. It is Schenk and Guest's closed form with
// sin psi = sin theta sin alpha, theta the angle between each facet and the
// sheet's plane. u runs across the panel, v down it, z out of the sheet
// towards the eye. Checked in Node for alpha from 55 to 85 degrees by 1 and
// psi from 0 to alpha in 400 steps, 12,431 shapes of 187 facets: every side
// stays 12 or 10 to within 6e-14, every corner's cosine stays cos alpha to
// within 2e-15, every facet stays flat to within 3e-14, and the four angles
// round each inside vertex add to 2 pi to within 6e-15.
// 17 facets down and 11 across: flat, the sheet is 191 rows by 90 LEDs on
// the panel; at the deepest fold at 55 degrees it is 125 by 52.
const M = 17, N = 11, NV = (M + 1) * (N + 1);
const B_LEN = 12, A_LEN = 10;
function sheet(alpha, psi, out) {
  const g = acos(cl(cos(alpha) / cos(psi), -1, 1));
  const bv = B_LEN * cos(psi), bz = B_LEN * sin(psi), au = A_LEN * sin(g), av = A_LEN * cos(g);
  const u0 = (N * au) / 2, v0 = (M * bv + av) / 2;
  let k = 0;
  for (let i = 0; i <= M; i++)
    for (let j = 0; j <= N; j++) {
      out[k++] = j * au - u0;
      out[k++] = i * bv + (j & 1) * av - v0;
      out[k++] = (i & 1) * bz - bz / 2;
    }
  return g;
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, speed: 2, alpha: 55 * DEG, light: 0.06,
    P: new Float64Array(NV * 3), sx: new Float32Array(NV), sy: new Float32Array(NV),
    key: new Float32Array(3), fill: new Float32Array(3),
    id: new Int16Array(NS), mark: new Uint8Array(NS),
    col: new Float32Array(M * N * 3), mv: new Int8Array(M * N * 2),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 55, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.alpha = cl(k[2], 55, 85) * DEG;
  S.light = cl(k[3], 0, 1);
  S.t += (d * S.speed) / 2;
}

const TILT = 24 * DEG; // how far the eye leans from straight above
const FOLD = 8; // seconds a fold and an opening at Speed 2

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { P, sx, sy, id, mark, col, mv, key, fill } = S;
  const f = 0.5 - 0.5 * cos((2 * PI * S.t) / FOLD);
  // psi runs from 3% to 100% of its deepest, 0.9 alpha or 60 degrees,
  // whichever is less: at 55 degrees the facets fold up to 68 degrees from
  // the sheet's plane.
  const psi = min(S.alpha * 0.9, PI / 3) * (0.03 + 0.97 * f);
  sheet(S.alpha, psi, P);
  const ct = cos(TILT), st = sin(TILT);
  // Vertices on the sample grid, two samples per LED each way. The eye looks
  // down at the sheet leaning TILT towards the bottom of the panel, so z
  // lifts a point up the screen.
  for (let k = 0, q = 0; k < NV; k++, q += 3) {
    sx[k] = (W / 2 + P[q]) * 2;
    sy[k] = (H / 2 + P[q + 1] * ct - P[q + 2] * st) * 2;
  }
  // Lights, in sheet coordinates: the key from the Light knob's side, 45
  // degrees up; the fill a quarter turn round from it, 15 degrees up. A
  // facet's four kinds (its row tilting up or down the sheet, its column
  // left or right) take these two lights four ways.
  const az = 2 * PI * (S.light + 0.69), e1 = 45 * DEG, e2 = 15 * DEG;
  const az2 = az + PI / 2, k1x = cos(e1) * cos(az), k1y = cos(e1) * sin(az), k1z = sin(e1), k2x = cos(e2) * cos(az2), k2y = cos(e2) * sin(az2), k2z = sin(e2);
  hsv(0.1 + S.hue, 0.7, 1, key, 0);
  hsv(0.58 + S.hue, 0.9, 0.75, fill, 0);
  id.fill(-1);
  for (let i = 0; i < M; i++)
    for (let j = 0; j < N; j++) {
      const v0 = i * (N + 1) + j, v1 = v0 + 1, v3 = v0 + N + 1, v2 = v3 + 1, fi = i * N + j;
      // Normal from the sides at P(i, j), turned to the front of the sheet (+z).
      const q0 = v0 * 3, q1 = v1 * 3, q3 = v3 * 3;
      const ax = P[q3] - P[q0], ay = P[q3 + 1] - P[q0 + 1], az3 = P[q3 + 2] - P[q0 + 2], bx = P[q1] - P[q0], by = P[q1 + 1] - P[q0 + 1], bz = P[q1 + 2] - P[q0 + 2];
      let nx = ay * bz - az3 * by, ny = az3 * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = sqrt(nx * nx + ny * ny + nz * nz) || 1;
      (nx /= nl), (ny /= nl), (nz /= nl);
      if (nz < 0) (nx = -nx), (ny = -ny), (nz = -nz);
      // The back of the sheet shows where the turned normal points away from the eye.
      const sgn = ny * st + nz * ct >= 0 ? 1 : -1;
      const d1 = max(0, sgn * (nx * k1x + ny * k1y + nz * k1z)), d2 = max(0, sgn * (nx * k2x + ny * k2y + nz * k2z)), back = sgn < 0 ? 0.5 : 1;
      for (let c = 0; c < 3; c++) col[fi * 3 + c] = back * (0.1 + key[c] * d1 + fill[c] * d2);
      // Mountain or valley for the crease to the next facet down (side 0)
      // and across (side 1): a mountain when that facet's far corner lies
      // below this facet's plane.
      if (i + 1 < M) {
        const q = (v3 + N + 1) * 3;
        mv[fi * 2] = (P[q] - P[q3]) * nx + (P[q + 1] - P[q3 + 1]) * ny + (P[q + 2] - P[q3 + 2]) * nz < 0 ? 1 : 2;
      }
      if (j + 1 < N) {
        const q = (v1 + 1) * 3;
        mv[fi * 2 + 1] = (P[q] - P[q1]) * nx + (P[q + 1] - P[q1 + 1]) * ny + (P[q + 2] - P[q1 + 2]) * nz < 0 ? 1 : 2;
      }
      // Rasterize. Seen from straight above, the folded sheet is a height
      // field over (u, v), and a ray from the eye leaning towards +v meets
      // larger v first, so drawing the rows in order down the sheet leaves
      // the nearest facet on top (checked against a depth buffer: the same
      // frames).
      const X0 = sx[v0], Y0 = sy[v0];
      const ux = sx[v1] - X0, uy = sy[v1] - Y0, wx = sx[v3] - X0, wy = sy[v3] - Y0;
      const det = ux * wy - uy * wx;
      if (abs(det) < 1e-6) continue;
      const xmin = max(0, floor(min(X0, sx[v1], sx[v2], sx[v3]))), xmax = min(SW - 1, ceil(max(X0, sx[v1], sx[v2], sx[v3])));
      const ymin = max(0, floor(min(Y0, sy[v1], sy[v2], sy[v3]))), ymax = min(SH - 1, ceil(max(Y0, sy[v1], sy[v2], sy[v3])));
      const inv = 1 / det, da = wy * inv, db = -uy * inv;
      for (let y = ymin; y <= ymax; y++) {
        const ry = y + 0.5 - Y0, rx = xmin + 0.5 - X0;
        // The sample as a + b along the two sides is inside when both lie in
        // 0..1; along a row each is linear in x, so the row's run is solved
        // for, not searched.
        const a0 = (rx * wy - ry * wx) * inv, b0 = (ux * ry - uy * rx) * inv;
        let lo = 0, hi = xmax - xmin;
        for (let e = 0; e < 2; e++) {
          const v0 = e ? b0 : a0, dv = e ? db : da;
          if (abs(dv) < 1e-12) {
            if (v0 < 0 || v0 > 1) hi = -1;
          } else {
            const t0 = -v0 / dv, t1 = (1 - v0) / dv;
            lo = max(lo, ceil(t0 < t1 ? t0 : t1));
            hi = min(hi, floor(t0 < t1 ? t1 : t0));
          }
        }
        for (let k = y * SW + xmin + lo, e = y * SW + xmin + hi; k <= e; k++) id[k] = fi;
      }
    }
  // Lines: a sample whose right or lower neighbour belongs to another facet
  // is on a crease (1 mountain, 2 valley) or on an edge where one part of
  // the sheet passes in front of another (3).
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const p = y * SW + x, a = id[p];
      mark[p] = 0;
      if (a < 0) continue;
      let t = 0;
      for (let side = 0; side < 2; side++) {
        if (side === 0 ? x + 1 >= SW : y + 1 >= SH) continue;
        const b = id[side === 0 ? p + 1 : p + SW];
        if (b === a || b < 0) continue;
        const lo = min(a, b), d = abs(a - b);
        let m = 3;
        if (d === N) m = mv[lo * 2];
        else if (d === 1 && ((a / N) | 0) === ((b / N) | 0)) m = mv[lo * 2 + 1];
        if (m > t) t = m;
      }
      mark[p] = t;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let s = 0; s < 4; s++) {
        const p = (2 * y + (s >> 1)) * SW + 2 * x + (s & 1), a = id[p];
        if (a < 0) continue;
        let cr = col[a * 3], cg = col[a * 3 + 1], cb = col[a * 3 + 2];
        const m = mark[p];
        if (m === 1) (cr = 0.45 + 0.55 * cr), (cg = 0.45 + 0.55 * cg), (cb = 0.45 + 0.55 * cb);
        else if (m >= 2) (cr *= 0.2), (cg *= 0.2), (cb *= 0.2);
        (r += cr), (g += cg), (b += cb);
      }
      display.setPixel(x, y, round(min(255, 63.75 * r)), round(min(255, 63.75 * g)), round(min(255, 63.75 * b)));
    }
}
