// ===== Patternflow pattern =====
// Title:   Miura-ori
// Family:  space
// Idea:    A Miura-ori sheet of congruent parallelograms folds and unfolds with its one degree of freedom, seen in 3D from above and a little below, so its rows of facets flip between the warm key light and the cool fill as the fold deepens, its mountain and valley creases show as light and dark lines, and the whole sheet shrinks in both directions at once and spreads out again.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Miura-ori (Koryo Miura, 1970; "Method of packaging and deployment of large membranes in space", 1985), its rigid folding as a translational surface (Mark Schenk and Simon Guest, 2013), pattern round 75
// Round:   75
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sector=55..85, Light=0..1
//
// Knob 1: Hue. The colour of the key light; the fill light from the other side takes the opposite hue.
// Knob 2: Speed. How fast the sheet folds and opens.
// Knob 3: Sector. The sector angle alpha of the parallelograms, in degrees.
// Knob 4: Light. Where the key light stands round the sheet.

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

// ---- The fold. A Miura-ori is a translational surface: P(i, j) = A(i) + B(j),
// with A a zigzag in the (v, z) plane whose steps are
//   eb(i) = (0, b cos psi, +-b sin psi)
// and B a zigzag in the (u, v) plane whose steps are
//   ea(j) = (a sin g, +-a cos g, 0).
// Every facet is then a parallelogram with sides eb(i) and ea(j), so its
// sides stay b and a whatever psi is, and its angle stays alpha (or pi -
// alpha, the same parallelogram turned over) as long as eb.ea = +-ab cos alpha,
// that is cos psi cos g = cos alpha. psi = 0 is the flat sheet (g = alpha);
// psi = alpha folds it flat into a packet (g = 0). The one parameter psi is
// the fold's one degree of freedom. u runs across the panel, v down it, z
// out of the sheet towards the eye.
const M = 17, N = 11, NV = (M + 1) * (N + 1); // facets down and across, vertices
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
    P: new Float64Array(NV * 3), sx: new Float32Array(NV), sy: new Float32Array(NV), sz: new Float32Array(NV),
    key: new Float32Array(3), fill: new Float32Array(3),
    id: new Int16Array(NS), depth: new Float32Array(NS), mark: new Uint8Array(NS),
    col: new Float32Array(M * N * 3), mv: new Int8Array(M * N * 2), rgb: new Float32Array(3),
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

const TILT = 28 * DEG; // the eye leans this far from straight above, towards the bottom of the panel
const FOLD = 8; // seconds a fold and an opening at Speed 2

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { P, sx, sy, sz, id, depth, mark, col, mv, rgb, key, fill } = S;
  const f = 0.5 - 0.5 * cos((2 * PI * S.t) / FOLD);
  const psi = S.alpha * (0.03 + 0.87 * f);
  sheet(S.alpha, psi, P);
  const ct = cos(TILT), st = sin(TILT);
  // Vertices on the sample grid (two samples per LED each way), and their
  // depth towards the eye.
  for (let k = 0, q = 0; k < NV; k++, q += 3) {
    sx[k] = (W / 2 + P[q]) * 2;
    sy[k] = (H / 2 + P[q + 1] * ct - P[q + 2] * st) * 2;
    sz[k] = P[q + 1] * st + P[q + 2] * ct;
  }
  // Lights, in sheet coordinates: the key from the Light knob's side, 40
  // degrees up; the fill from the opposite side, 12 degrees up.
  const az = 2 * PI * (S.light + 0.69), e1 = 35 * DEG, e2 = 15 * DEG;
  const az2 = az + PI / 2, k1x = cos(e1) * cos(az), k1y = cos(e1) * sin(az), k1z = sin(e1), k2x = cos(e2) * cos(az2), k2y = cos(e2) * sin(az2), k2z = sin(e2);
  hsv(0.1 + S.hue, 0.7, 1, key, 0);
  hsv(0.58 + S.hue, 0.9, 0.75, fill, 0);
  id.fill(-1);
  depth.fill(-1e9);
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
      for (let c = 0; c < 3; c++) col[fi * 3 + c] = back * (0.04 + key[c] * d1 + fill[c] * d2);
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
      // Rasterize: a sample is inside when it is on the inner side of all
      // four edges; its depth comes from the facet's plane.
      const X0 = sx[v0], Y0 = sy[v0], Z0 = sz[v0];
      const ux = sx[v1] - X0, uy = sy[v1] - Y0, uz = sz[v1] - Z0, wx = sx[v3] - X0, wy = sy[v3] - Y0, wz = sz[v3] - Z0;
      const det = ux * wy - uy * wx;
      if (abs(det) < 1e-6) continue;
      const xmin = max(0, floor(min(X0, sx[v1], sx[v2], sx[v3]))), xmax = min(SW - 1, ceil(max(X0, sx[v1], sx[v2], sx[v3])));
      const ymin = max(0, floor(min(Y0, sy[v1], sy[v2], sy[v3]))), ymax = min(SH - 1, ceil(max(Y0, sy[v1], sy[v2], sy[v3])));
      const inv = 1 / det;
      for (let y = ymin; y <= ymax; y++) {
        const ry = y + 0.5 - Y0;
        for (let x = xmin; x <= xmax; x++) {
          const rx = x + 0.5 - X0;
          // The sample as a + b along the two sides: inside when both lie in 0..1.
          const a = (rx * wy - ry * wx) * inv, b = (ux * ry - uy * rx) * inv;
          if (a < 0 || a > 1 || b < 0 || b > 1) continue;
          const zz = Z0 + a * uz + b * wz, p = y * SW + x;
          if (zz > depth[p]) (depth[p] = zz), (id[p] = fi);
        }
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
