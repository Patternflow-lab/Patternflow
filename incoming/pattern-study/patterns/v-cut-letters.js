// ===== Patternflow pattern =====
// Title:   V-Cut Letters
// Family:  type
// Idea:    LVX stands up the panel in three Roman capitals cut into stone with a V chisel, each stroke a groove whose flat walls meet in a sharp line down its middle, and a low light walks round the stone so the walls flip between lit and shadowed one facet at a time while the uncut surface keeps one dim tone, and the letters are read only from how the light falls on the planes.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: V-cut letter carving of Roman inscriptions, with the roof of a polygon as its straight skeleton (Oswin Aichholzer, Franz Aurenhammer, David Alberts and Bernd Gärtner, 1995), pattern round 77
// Round:   77
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wall=30..70, Light=0..1
//
// Knob 1: Hue. The colour of the light, with the sky's fill in the shaded walls opposite it on the wheel: at 0 a pale gold sun and navy shade on blue-grey stone; 0.25 green light and purple shade, 0.5 blue moonlight and amber shade on warm grey, 0.75 pink light and green shade.
// Knob 2: Speed. How fast the light walks round the stone: at 2 one turn in 12 s, so a wall swings from its brightest to its darkest in 6 s; at 0.2 a turn takes 2 minutes, at 3 eight seconds.
// Knob 3: Wall. How steep the chisel's walls stand, in degrees from the surface: 30 at the opening, a shallow cut, 2.9 LEDs deep under the 10 LED stems, where a light square across a stroke leaves the lower 28% of the lit wall in the lip's shadow; at 50 a V of 80 degrees between its walls, twice as deep; at 70 the groove is 13.7 LEDs deep, the lip shades 79% of the lit wall and the letters are mostly dark cuts with a bright edge.
// Knob 4: Light. How high the light stands above the stone, from 15 degrees at 0 to 75 at 1: 18 at the opening 0.06, raking, lower than the 30 degree walls, so the wall turned away goes into shade; at 45 (0.5) that wall keeps a quarter of the light; at 75, steeper than any wall the knob allows, the lip throws no shadow, and with the opening's 30 degree walls both sides of a groove stay lit and the letters go pale.

// A letter cut with a V chisel is a groove whose two walls are planes that
// slope down from the outline at the same angle and meet along a line. For
// a stroke whose outline is a convex polygon, the depth under a point is
// the slope times its distance to the nearest edge of the outline: every
// edge carries one plane, and two planes meet where a point is equally far
// from two edges. Those meeting lines are the straight skeleton of the
// polygon, which Aichholzer, Aurenhammer, Alberts and Gärtner defined in
// 1995 by moving every edge inward at the same speed; lifted, it is a roof
// whose planes all slope at one angle. For a convex outline it is the same
// as the medial axis. A long stroke has a sharp line down its middle and a
// hip at each end, and in a triangular serif three facets meet at one
// deepest point. Where two strokes cross, the chisel takes away both, so
// the deeper cut wins.
//
// Each LED is four samples. A sample inside a stroke takes the normal of
// the plane of its nearest edge; the light, at a fixed height and walking
// round, lights it by Lambert's cosine, and the sky gives the shaded walls a
// little of the opposite colour. The light is then followed from the LED's
// centre across the depth field toward the lamp: where the stone in between
// stands higher than the ray, the lip of the groove casts its shadow. The
// uncut stone is not lit by the moving light at all, so the letters are
// only what the facets do.
//
// The capitals are polygons drawn for this pattern, after the Roman
// inscriptional capital: thick strokes down and down to the right, thin
// ones across and down to the left, a pointed V that dips a row below the
// line, and wedge serifs cut shallower than the stems. In Roman
// inscriptions U is V, so the word is LVX, light.

const W = 64, H = 128;
const { floor, min, max, sqrt, sin, cos, tan, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const RAD = PI / 180;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

// Where line ab meets line cd.
function meet(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / (r[0] * s[1] - r[1] * s[0]);
  return [a[0] + t * r[0], a[1] + t * r[1]];
}
// A slanted stroke as a parallelogram from top centre to bottom centre,
// cut level at both ends, w LEDs wide across.
function bar(xa, ya, xb, yb, w) {
  const hw = ((w / 2) * Math.hypot(xb - xa, yb - ya)) / Math.abs(yb - ya);
  return [[xa - hw, ya], [xa + hw, ya], [xb + hw, yb], [xb - hw, yb]];
}

// The letters in a box 39 LEDs tall, y down from the cap line.
const L = [
  [[10, 0], [20, 0], [20, 38], [10, 38]],
  [[4, 0], [26, 0], [21, 4], [9, 4]],
  [[10, 32], [48, 32], [48, 38], [10, 38]],
  [[41, 32], [50, 24], [50, 38], [41, 38]],
  [[3, 38], [10, 33], [10, 38]],
];
const vOL = [4, 0], vIL = [15, 0], vOR = [50, 0], vIR = [43, 0], vA = [27, 39];
const vIL2 = [vIL[0] + vA[0] - vOL[0], vIL[1] + vA[1]], vIR2 = [vIR[0] + vA[0] - vOR[0], vIR[1] + vA[1]];
const V = [
  [vOL, vIL, meet(vIL, vIL2, vOR, vA), vA],
  [vIR, vOR, vA, meet(vIR, vIR2, vOL, vA)],
  [[-1, 0], [21, 0], [18, 4], [6, 4]],
  [[38, 0], [55, 0], [48, 4], [40, 4]],
];
const X = [
  bar(10, 0, 44, 38, 10),
  bar(40, 0, 12, 38, 6),
  [[0, 0], [21, 0], [19, 4], [8, 4]],
  [[31, 0], [47, 0], [41, 4], [33.5, 4]],
  [[11.5, 34], [18.5, 34], [23, 38], [4, 38]],
  [[35, 34], [46, 34], [55, 38], [31, 38]],
];
const WORD = [[L, 3], [V, 45], [X, 87]];

// Every polygon as its edges: a point and the inward unit normal.
function build() {
  const polys = [];
  for (const [letter, top] of WORD) {
    let x0 = 1e9, x1 = -1e9;
    for (const p of letter) for (const q of p) (x0 = min(x0, q[0])), (x1 = max(x1, q[0]));
    const dx = 31.5 - (x0 + x1) / 2;
    for (const p of letter) {
      const pts = p.map((q) => [q[0] + dx, q[1] + top]);
      let cx = 0, cy = 0;
      for (const q of pts) (cx += q[0] / pts.length), (cy += q[1] / pts.length);
      const edges = [];
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        let nx = a[1] - b[1], ny = b[0] - a[0];
        const l = Math.hypot(nx, ny);
        (nx /= l), (ny /= l);
        if (nx * (cx - a[0]) + ny * (cy - a[1]) < 0) (nx = -nx), (ny = -ny);
        edges.push([a[0], a[1], nx, ny]);
        (bx0 = min(bx0, a[0])), (bx1 = max(bx1, a[0])), (by0 = min(by0, a[1])), (by1 = max(by1, a[1]));
      }
      polys.push({ edges, bx0, bx1, by0, by1 });
    }
  }
  return polys;
}

// Distance in from the outline at (x, y) and the inward normal of the
// nearest edge, the deepest stroke winning; 0 outside every stroke.
function sample(polys, x, y, out) {
  let best = 0, nx = 0, ny = 0;
  for (const P of polys) {
    if (x < P.bx0 || x > P.bx1 || y < P.by0 || y > P.by1) continue;
    let d = 1e9, ex = 0, ey = 0;
    for (const e of P.edges) {
      const v = (x - e[0]) * e[2] + (y - e[1]) * e[3];
      if (v < d) (d = v), (ex = e[2]), (ey = e[3]);
    }
    if (d > best) (best = d), (nx = ex), (ny = ey);
  }
  out[0] = best;
  out[1] = nx;
  out[2] = ny;
}

const SUB = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];

export function setup(params) {
  const polys = build(), n = W * H, o = [0, 0, 0];
  const sd = new Float32Array(n * 4), sx = new Float32Array(n * 4), sy = new Float32Array(n * 4), dc = new Float32Array(n);
  const grain = new Float32Array(n);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      for (let k = 0; k < 4; k++) {
        sample(polys, x + SUB[k][0], y + SUB[k][1], o);
        sd[p * 4 + k] = o[0];
        sx[p * 4 + k] = o[1];
        sy[p * 4 + k] = o[2];
      }
      sample(polys, x + 0.5, y + 0.5, o);
      dc[p] = o[0];
      // A fixed grain in the stone, a few percent either way.
      let h = (x * 374761393 + y * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      grain[p] = 0.94 + 0.12 * (((h ^ (h >>> 16)) >>> 0) / 4294967296);
    }
  params.s = { sd, sx, sy, dc, grain, phi: 2.2, hue: 0, wall: 30, elev: 18, lc: [0, 0, 0], kc: [0, 0, 0], fc: [0, 0, 0] };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 30, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.wall = cl(k[2] == null ? 30 : k[2], 30, 70);
  S.elev = 15 + 60 * cl(k[3] == null ? 0.06 : k[3], 0, 1);
  S.phi += (d * 2 * PI * speed) / 24;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { sd, sx, sy, dc, grain, lc, kc, fc } = S;
  const sl = tan(S.wall * RAD), th = S.elev * RAD, ct = cos(th), st = sin(th), tt = st / ct, nrm = 1 / sqrt(1 + sl * sl);
  const lx = cos(S.phi), ly = sin(S.phi);
  // The light's colour, the sky's fill and the uncut stone's tone.
  hsv(0.12 + S.hue, 0.46, 1.1, lc);
  hsv(0.62 + S.hue, 0.65, 0.13, kc);
  hsv(0.62 + S.hue, 0.16, 0.26, fc);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, g = grain[p];
      // The lip's shadow, followed from the centre toward the light.
      let shade = 1;
      const D = sl * dc[p];
      if (D > 0) {
        let m = 1e9;
        for (let j = 1; j < 40; j++) {
          const rise = j * 0.75 * tt;
          if (rise > D + 0.6) break;
          const qx = x + 0.5 + lx * j * 0.75, qy = y + 0.5 + ly * j * 0.75;
          const ix = floor(qx), iy = floor(qy);
          const dq = ix < 0 || ix >= W || iy < 0 || iy >= H ? 0 : sl * dc[iy * W + ix];
          m = min(m, rise - (D - dq));
        }
        shade = cl(0.5 + m / 1.2, 0, 1);
      }
      let r = 0, gg = 0, b = 0;
      for (let k = 0; k < 4; k++) {
        const i = p * 4 + k;
        if (sd[i] <= 0) {
          r += fc[0];
          gg += fc[1];
          b += fc[2];
          continue;
        }
        const nl = max(0, (sl * ct * (sx[i] * lx + sy[i] * ly) + st) * nrm) * shade;
        r += lc[0] * nl + kc[0];
        gg += lc[1] * nl + kc[1];
        b += lc[2] * nl + kc[2];
      }
      const f = (255 / 4) * g;
      display.setPixel(x, y, min(255, floor(r * f)), min(255, floor(gg * f)), min(255, floor(b * f)));
    }
}
