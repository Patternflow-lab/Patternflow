// ===== Patternflow pattern =====
// Title:   Polytope Slices
// Family:  space
// Idea:    A regular four-dimensional polytope passes down through three parallel 3D hyperplanes stacked up the panel while it tilts slowly in 4D, and each cut is drawn as a flat-shaded solid turning in space that swells from a point or a whole cell into a polyhedron, changes shape each time its hyperplane crosses a layer of vertices and shrinks away, every face coloured by the 4D cell it lies in.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the regular convex 4-polytopes (Ludwig Schläfli, 1852), pattern round 41
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Polytope=0..3, Tilt=-1..1
//
// Knob 1: Hue. Turns the cell colours round the wheel together. At 0 the 24-cell's three families of cells, three 16-cells' worth that never share a face, are teal, violet and rose; the tesseract and the 16-cell add azure and the 5-cell plum. A face that comes round to orange, yellow or lime is paled and lit higher, so it never reads brown or olive.
// Knob 2: Speed. At 2 a pass takes 7 seconds, from the top slice's first point to the bottom slice's last, and a pass spends most of it near the polytope's middle and crosses its outer fifth fast; at 0.2 it takes 70 seconds, at 3 under 5. The slices turn round the vertical once in 12.6 seconds at 2, and the 4D wander keeps the same pace.
// Knob 3: Polytope. 0 the 24-cell (24 octahedra, its slices up to 18 faces), 1 the tesseract (8 cubes, up to 8), 2 the 16-cell (16 tetrahedra, up to 14), 3 the 5-cell (5 tetrahedra, up to 5). Each is scaled so its circumradius is 29 LEDs, and a slice through the middle can fill the panel's width.
// Knob 4: Tilt. Swings the hyperplanes' normal from the centre of one cell (-1) to a vertex of that cell (+1), 45 degrees for the 24-cell, 60 for the tesseract and the 16-cell, 75.5 for the 5-cell. At -1 nothing turns in 4D: the 24-cell comes in as a whole octahedron, is a truncated octahedron all the way down and a cuboctahedron at its middle, and the tesseract is one cube that appears and vanishes whole. At +1 the tesseract grows from a point as a tetrahedron, is truncated from half its reach on and is an octahedron at the middle, and the 24-cell grows as a cube, chamfers and is a rhombic dodecahedron at the middle. Between the ends the normal wanders up to 0.3 radians toward the vertex and 0.9 round it, most at 0, so the polytope turns slowly in 4D and no two passes are alike.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, abs, round, acos, hypot } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// A polytope is its facets, one per 3D cell (unit normal n and offset d, the
// cell lying in n.x = d and the polytope in n.x <= d), a colour class per
// cell chosen so two cells that share a 2-face never share a class, and its
// vertices. It is turned once so that the centre of one cell lies on the
// fourth axis and a vertex of that same cell in the plane of the first and
// fourth axes, alpha away: Tilt swings the hyperplanes' normal through that
// angle, from the cell to the vertex.
function build(normals, d, cls, verts, cellAxis, vertexAxis) {
  const unit = (x) => {
    const l = hypot(x[0], x[1], x[2], x[3]);
    return x.map((t) => t / l);
  };
  const g4 = unit(cellAxis), vv = unit(vertexAxis), c = dot4(vv, g4);
  const G = [unit(vv.map((t, i) => t - c * g4[i])), g4];
  for (const e of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) {
    if (G.length === 4) break;
    let w = e.slice();
    for (const g of G) {
      const p = dot4(w, g);
      w = w.map((t, i) => t - p * g[i]);
    }
    if (hypot(w[0], w[1], w[2], w[3]) > 1e-6) G.push(unit(w));
  }
  const B = [G[0], G[2], G[3], G[1]], to = (x) => B.map((b) => dot4(b, x));
  // The edges: pairs of vertices at the shortest distance.
  const dist = (a, b) => hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]);
  let shortest = 1e9;
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) shortest = min(shortest, dist(verts[i], verts[j]));
  const edges = [];
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) if (dist(verts[i], verts[j]) < shortest + 1e-9) edges.push(i, j);
  return {
    n: normals.map(to).flat(), d, cls, v: verts.map(to).flat(), k: normals.length, edges,
    R: hypot(verts[0][0], verts[0][1], verts[0][2], verts[0][3]), alpha: acos(c),
  };
}
const sgn = (m, i) => ((m >> i) & 1 ? -1 : 1);
const pop = (m) => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
const axes = () => {
  const out = [];
  for (let i = 0; i < 4; i++)
    for (const s of [1, -1]) {
      const e = [0, 0, 0, 0];
      e[i] = s;
      out.push([e, i]);
    }
  return out;
};
const halves = () => Array.from({ length: 16 }, (_, m) => [[0, 1, 2, 3].map((i) => sgn(m, i) / 2), pop(m)]);

// The 24-cell: 24 octahedra, 24 vertices (+-1, +-1, 0, 0). Its cells fall
// into three 16-cells' worth, and cells in the same one never touch.
function cell24() {
  const f = [...axes().map(([e]) => [e, 0]), ...halves().map(([e, p]) => [e, 1 + (p & 1)])], v = [];
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++)
      for (let m = 0; m < 4; m++) {
        const e = [0, 0, 0, 0];
        e[i] = sgn(m, 0);
        e[j] = sgn(m, 1);
        v.push(e);
      }
  return build(f.map((x) => x[0]), f.map(() => 1), f.map((x) => x[1]), v, [0, 0, 0, 1], [1, 0, 0, 1]);
}
// The tesseract: 8 cubes, opposite ones share a colour.
function tesseract() {
  const f = axes();
  const v = Array.from({ length: 16 }, (_, m) => [0, 1, 2, 3].map((i) => sgn(m, i)));
  return build(f.map((x) => x[0]), f.map(() => 1), f.map((x) => x[1]), v, [0, 0, 0, 1], [1, 1, 1, 1]);
}
// The 16-cell: 16 tetrahedra; two touch when their normals differ in one
// sign, so the count of minus signs, mod 4, never repeats across a face.
function cell16() {
  const f = halves();
  return build(f.map((x) => x[0]), f.map(() => 0.5), f.map((x) => x[1] & 3), axes().map(([e]) => e), [1, 1, 1, 1], [1, 0, 0, 0]);
}
// The 5-cell: 5 tetrahedra, every one touching every other.
function cell5() {
  const a = 1 / sqrt(5), R = sqrt(3.2);
  const v = [[1, 1, 1, -a], [1, -1, -1, -a], [-1, 1, -1, -a], [-1, -1, 1, -a], [0, 0, 0, 4 * a]];
  return build(v.map((p) => p.map((x) => -x / R)), v.map(() => R / 4), [0, 1, 2, 3, 4], v, v[0].map((x) => -x), v[4]);
}
const POLY = [cell24(), tesseract(), cell16(), cell5()];

// LEDs to the circumradius: a slice through the centre is up to 58 LEDs
// across. The map's detail comes from the seams and rims and its drift from
// the dark moment between passes, and both grow with the slices: at 28 they
// read 0.092 and 0.357, at 30 0.096 and 0.401, near the drift axis's end.
const FILL = 29;
// How far a rim LED is lifted toward white, and a seam's share of its face.
const RING = 0.5, SEAM = 0.06;
// The three hyperplanes' rows, and how far apart they lie in 4D as a share
// of the polytope's reach along the normal: close enough that the three cuts
// are plainly one solid, far enough that the top one empties first.
const SLOT_Y = [23, 64, 105], DEL = 0.22;
// Seconds a pass takes at Speed 1, and how much of it the slices spend near
// the middle: the hyperplanes cross the outer fifth of the polytope fast.
const PASS = 14, DW = 0.3;
// Opening hues of the five colour classes: teal, violet, rose, azure, plum.
const PAL = [0.5, 0.75, 0.92, 0.6, 0.83];
// Light from the upper left, in front.
const LX = -0.45, LY = -0.55, LZ = -0.7;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, poly: 0, tilt: 0.06,
    pass: 0.15, spin: 0.7, view: 0.4,
    m: new Float64Array(3 * 24), w: new Float64Array(24), fcol: new Float32Array(3 * 24),
    vx: new Float64Array(24), vy: new Float64Array(24), vw: new Float64Array(24),
    fa: new Float64Array(24), fb: new Float64Array(24), fc: new Float64Array(24), fr: new Float64Array(24), fi: new Int8Array(24),
    ba: new Float64Array(24), bb: new Float64Array(24), bc: new Float64Array(24), br: new Float64Array(24),
    col: new Float32Array(5 * 3), warm: new Float32Array(5),
    id: new Int16Array(W * H), rgb: new Float32Array(W * H * 3), z: new Float32Array(W * H), e: new Uint8Array(W * H),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.poly = min(3, floor(cl(k[2], 0, 3) + 0.5));
  S.tilt = cl(k[3], -1, 1);
  const v = d * S.speed;
  S.pass += v / PASS;
  S.spin += v * 0.12;
  S.view += v * 0.25;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const P = POLY[S.poly], K = P.k, m = S.m, w = S.w, fcol = S.fcol, id = S.id, rgb = S.rgb, z = S.z, col = S.col, warm = S.warm;
  for (let c = 0; c < 5; c++) {
    const h = S.hue + PAL[c], hh = h - floor(h);
    // Orange to lime would read brown or olive in shadow: paler, lit higher.
    warm[c] = min(1, max(0, 1.6 - abs(hh - 0.15) / 0.1));
    hsv(h, 0.75 - 0.25 * warm[c], 1, col, c * 3);
  }
  // The hyperplanes' normal u, in the polytope's frame: tilted theta from
  // the cell axis toward D, D a unit vector in the first three axes near the
  // vertex. Between the ends of Tilt both wander, so the polytope turns in 4D.
  const t4 = S.tilt, amp = 1 - t4 * t4;
  const th = (P.alpha * (t4 + 1)) / 2 + 0.3 * amp * sin(S.spin);
  const ph = 0.9 * amp * sin(0.77 * S.spin + 1), ps = 0.9 * amp * sin(0.53 * S.spin + 2);
  const D0 = cos(ph) * cos(ps), D1 = sin(ph) * cos(ps), D2 = sin(ps), ct = cos(th), st = sin(th);
  // The hyperplane's own axes are the first three axes turned with u, in
  // the plane of D and the fourth axis; then the whole slice turns round the
  // panel's vertical and leans 0.45 radians toward the viewer.
  const ca = cos(S.view), sa = sin(S.view), cb = cos(0.45), sb = sin(0.45);
  for (let f = 0, o = 0; f < K; f++, o += 4) {
    const n0 = P.n[o], n1 = P.n[o + 1], n2 = P.n[o + 2], n3 = P.n[o + 3], nD = n0 * D0 + n1 * D1 + n2 * D2, g = (ct - 1) * nD - st * n3;
    const x0 = n0 + D0 * g, y0 = n1 + D1 * g, z0 = n2 + D2 * g;
    const x1 = ca * x0 + sa * z0, z1 = -sa * x0 + ca * z0;
    m[f * 3] = x1;
    m[f * 3 + 1] = cb * y0 - sb * z1;
    m[f * 3 + 2] = sb * y0 + cb * z1;
    w[f] = st * nD + ct * n3;
    // Flat shading, 0.32 to 0.92 of the cell's colour by how the face meets
    // the light.
    const nx = m[f * 3], ny = m[f * 3 + 1], nz = m[f * 3 + 2], c3 = P.cls[f];
    const lit0 = 0.32 + 0.6 * max(0, (nx * LX + ny * LY + nz * LZ) / sqrt(nx * nx + ny * ny + nz * nz)), lit = lit0 + (1 - lit0) * 0.75 * warm[c3];
    for (let i = 0; i < 3; i++) fcol[f * 3 + i] = col[c3 * 3 + i] * lit;
  }
  // Each vertex on the screen (vx, vy) and along u (vw), to find where the
  // edges cross a hyperplane and so the slice's own box on the panel.
  const { vx, vy, vw } = S;
  let reach = 0;
  for (let j = 0, o = 0; o < P.v.length; j++, o += 4) {
    const v0 = P.v[o], v1 = P.v[o + 1], v2 = P.v[o + 2], v3 = P.v[o + 3], vD = v0 * D0 + v1 * D1 + v2 * D2, g = (ct - 1) * vD - st * v3;
    const x0 = v0 + D0 * g, y0 = v1 + D1 * g, z0 = v2 + D2 * g;
    vx[j] = ca * x0 + sa * z0;
    vy[j] = cb * y0 - sb * (-sa * x0 + ca * z0);
    vw[j] = st * vD + ct * v3;
    reach = max(reach, vw[j]);
  }
  id.fill(0);
  rgb.fill(0);
  z.fill(1e9);
  const sc = FILL / P.R, E = P.edges;
  const { fa, fb, fc, fr, fi, ba, bb, bc, br } = S;
  // One pass: the middle hyperplane runs from (1 + DEL) reach to -(1 + DEL)
  // reach, the top one DEL behind it and the bottom one DEL ahead, so the
  // top meets the polytope first.
  const a = S.pass - floor(S.pass), u = 1 - 2 * a, mid = (1 + DEL) * u * (DW + (1 - DW) * u * u * u * u);
  for (let s = 0; s < 3; s++) {
    const c = reach * (mid - (1 - s) * DEL);
    if (abs(c) >= reach) continue;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let q = 0; q < E.length; q += 2) {
      const i = E[q], j = E[q + 1], wi = vw[i] - c, wj = vw[j] - c;
      if (wi * wj > 0 || wi === wj) continue;
      const t = wi / (wi - wj), X = vx[i] + t * (vx[j] - vx[i]), Y = vy[i] + t * (vy[j] - vy[i]);
      (x0 = min(x0, X)), (x1 = max(x1, X)), (y0 = min(y0, Y)), (y1 = max(y1, Y));
    }
    if (x1 < x0) continue;
    // Along the view ray (X, Y, t) a face's half-space starts or ends at
    // t = a + b X + c Y: faces turned toward the viewer give where the ray
    // may enter, the others where it must leave. The face of the latest
    // entry is the one seen.
    let nf = 0, nb = 0, side = false;
    for (let f = 0; f < K; f++) {
      const h = P.d[f] - c * w[f], mx = m[f * 3], my = m[f * 3 + 1], mz = m[f * 3 + 2];
      if (mz < -1e-9) (fa[nf] = h / mz), (fb[nf] = -mx / mz), (fc[nf] = -my / mz), (fi[nf++] = f);
      else if (mz > 1e-9) (ba[nb] = h / mz), (bb[nb] = -mx / mz), (bc[nb++] = -my / mz);
      else side = true;
    }
    const cy = SLOT_Y[s], cx = 31.5;
    const ya = max(0, floor(cy + y0 * sc)), yb = min(H - 1, floor(cy + y1 * sc)), xa = max(0, floor(cx + x0 * sc)), xb = min(W - 1, floor(cx + x1 * sc));
    for (let y = ya; y <= yb; y++) {
      const Y = (y + 0.5 - cy) / sc;
      for (let f = 0; f < nf; f++) fr[f] = fa[f] + fc[f] * Y;
      for (let f = 0; f < nb; f++) br[f] = ba[f] + bc[f] * Y;
      for (let x = xa; x <= xb; x++) {
        const X = (x + 0.5 - cx) / sc;
        let lo = -1e9, hi = 1e9, face = -1;
        for (let f = 0; f < nf; f++) {
          const t = fr[f] + fb[f] * X;
          if (t > lo) (lo = t), (face = f);
        }
        for (let f = 0; f < nb && hi > lo; f++) {
          const t = br[f] + bb[f] * X;
          if (t < hi) hi = t;
        }
        if (lo >= hi || face < 0) continue;
        if (side) {
          let out = false;
          for (let f = 0; f < K && !out; f++) if (abs(m[f * 3 + 2]) <= 1e-9 && P.d[f] - c * w[f] - m[f * 3] * X - m[f * 3 + 1] * Y < 0) out = true;
          if (out) continue;
        }
        face = fi[face];
        // A lower slice stands in front of the one above where they overlap.
        const q = y * W + x, zz = lo - s * 100;
        if (zz >= z[q]) continue;
        z[q] = zz;
        id[q] = s * 64 + face + 1;
        rgb[q * 3] = fcol[face * 3];
        rgb[q * 3 + 1] = fcol[face * 3 + 1];
        rgb[q * 3 + 2] = fcol[face * 3 + 2];
      }
    }
  }
  // Seams: an LED with a 4-neighbour on another lit face, so two LEDs wide.
  // Rims: an LED beside a seam or beside the dark.
  const e = S.e;
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q++) {
      const i = id[q];
      e[q] = 0;
      if (!i) continue;
      const l = x > 0 ? id[q - 1] : i, r = x < W - 1 ? id[q + 1] : i, u = y > 0 ? id[q - W] : i, d = y < H - 1 ? id[q + W] : i;
      e[q] = (l && l !== i) || (r && r !== i) || (u && u !== i) || (d && d !== i) ? 2 : !l || !r || !u || !d ? 3 : 1;
    }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q++) {
      if (e[q] !== 1) continue;
      if ((x > 0 && e[q - 1] === 2) || (x < W - 1 && e[q + 1] === 2) || (y > 0 && e[q - W] === 2) || (y < H - 1 && e[q + W] === 2)) e[q] = 3;
    }
  for (let q = 0, y = 0; y < H; y++)
    for (let x = 0; x < W; x++, q++) {
      let r = rgb[q * 3], g = rgb[q * 3 + 1], b = rgb[q * 3 + 2];
      if (e[q] === 3) {
        const o = P.cls[(id[q] - 1) & 63] * 3;
        (r = col[o] + (1 - col[o]) * RING), (g = col[o + 1] + (1 - col[o + 1]) * RING), (b = col[o + 2] + (1 - col[o + 2]) * RING);
      } else if (e[q] === 2) (r *= SEAM), (g *= SEAM), (b *= SEAM);
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}
