// ===== Patternflow pattern =====
// Title:   Ruled Hyperboloid
// Family:  space
// Idea:    Two equal circles, one above the other, are joined by straight rods; the top circle twists against the bottom, so the rods stand as a cylinder, pull in to a hyperboloid with a waist, close to a double cone through one point and open again, while the rods twisted the other way, the surface's second ruling, cross them into the lattice of a Shukhov tower that fills the panel's height and slowly turns.
// Author:  patternflow-lab
// Date:    2026-10-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the hyperboloid of one sheet swept by a straight line turned about an axis it does not meet (Christopher Wren, 1669), built in straight bars by Vladimir Shukhov from 1896, pattern round 80
// Round:   80
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rods=16..48, Ruling=-1..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the first ruling is azure, the second violet and the waist ring pale gold; at 0.5 the rulings are orange and green and the waist ring pale blue.
// Knob 2: Speed. At 2 the twist breathes from cylinder to cone and back in 12 s and the tower turns once in 20 s; every time goes as 2 / Speed.
// Knob 3: Rods. Rods in each ruling, 16 at the opening and up to 48: 32 to 96 straight lines in all.
// Knob 4: Ruling. How the two rulings share the light. At 0 both are full; the opening 0.06 dims the second to 94%. At 1 only the first ruling is left, the rods twisted one way, and at -1 only the second, the same surface twisted the other way.

// Join a circle of radius R at the bottom to an equal one at the top by a
// straight rod from angle phi below to angle phi + theta above. At
// theta = 0 the rods stand upright and sweep a cylinder. For 0 < theta < pi
// every rod passes the axis at the distance R cos(theta / 2), at mid
// height, and together they sweep a hyperboloid of one sheet whose waist
// is that circle. At theta = pi each rod goes straight through the axis and
// the rods meet at one point: a double cone. Rods from phi to phi - theta
// sweep the very same surface, so the hyperboloid holds two families of
// straight lines, its two rulings, and through each of its points passes
// one line of each. Shukhov's towers are this: two sets of straight bars,
// leaning opposite ways, joined where they cross.
//
// At theta = 0 and at theta = pi the two rulings fall on the same lines,
// so the lattice closes to a single set of rods at both ends of the breath.
//
// The tower is seen in perspective from four fifths of the way up its
// height, so the top circle shows its underside and the bottom one its top.
// The near rods are bright and the far ones dim, each rod shaded along its
// length by how near each part of it comes.

const W = 64, H = 128;
const { floor, ceil, min, max, sin, cos, sqrt, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;
const ONE = [1, 1, 1];

// Radius 1, half height HH, eye at distance D from the axis, the view
// tilted down by TILT radians.
const HH = 1.85, D = 7, TILT = 0.16;
const CT = cos(TILT), ST = sin(TILT);

// Fit both circles into the panel, rows 1.5 to 126.5 and columns 2 to 62.
let K = 1, CX = 32, CY = 64;
{
  let y0 = 1e9, y1 = -1e9, x1 = 0;
  for (let i = 0; i < 360; i++) {
    const a = (i * TAU) / 360, x = cos(a), z = sin(a);
    for (const y of [-HH, HH]) {
      const yc = y * CT - z * ST, s = 1 / (D - (y * ST + z * CT));
      y0 = min(y0, yc * s);
      y1 = max(y1, yc * s);
      x1 = max(x1, x * s);
    }
  }
  K = min(125 / (y1 - y0), 30 / x1);
  CY = 1.5 + K * y1 + (125 - K * (y1 - y0)) / 2;
}

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// Add colour c times a to the four LEDs around (x, y), bilinear.
function splat(buf, x, y, c, a) {
  x -= 0.5;
  y -= 0.5;
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let j = 0; j < 2; j++) {
    const yy = iy + j;
    if (yy < 0 || yy >= H) continue;
    const wy = j ? fy : 1 - fy;
    for (let i = 0; i < 2; i++) {
      const xx = ix + i;
      if (xx < 0 || xx >= W) continue;
      const w = a * wy * (i ? fx : 1 - fx), p = (yy * W + xx) * 3;
      buf[p] += c[0] * w;
      buf[p + 1] += c[1] * w;
      buf[p + 2] += c[2] * w;
    }
  }
}

// How near a point is: 0 at the far side of the circle, 1 at the near side,
// and the light it gets from that.
const shade = (z) => {
  const d = cl((z + 1) / 2, 0, 1);
  return 0.16 + 0.84 * d * sqrt(d);
};

// A straight piece of the world from (ax, ay, az) to (bx, by, bz), drawn as
// a line one LED thick, each step lit by its own nearness.
const P = [0, 0];
function project(x, y, z) {
  const s = 1 / (D - (y * ST + z * CT));
  P[0] = CX + K * x * s;
  P[1] = CY - K * (y * CT - z * ST) * s;
}
function piece(buf, ax, ay, az, bx, by, bz, c, a) {
  project(ax, ay, az);
  const sx = P[0], sy = P[1];
  project(bx, by, bz);
  const len = sqrt((P[0] - sx) ** 2 + (P[1] - sy) ** 2), n = max(1, ceil(len * 1.6)), step = len / n;
  for (let k = 0; k <= n; k++) {
    const t = k / n, z = az + (bz - az) * t;
    project(ax + (bx - ax) * t, ay + (by - ay) * t, z);
    splat(buf, P[0], P[1], c, a * shade(z) * step * (k === 0 || k === n ? 0.5 : 1));
  }
}

// A horizontal circle of radius r at height y.
function ring(buf, r, y, c, a) {
  if (r < 0.02) {
    project(0, y, 0);
    splat(buf, P[0], P[1], c, a * 2);
    return;
  }
  const n = max(8, ceil(r * 40));
  for (let i = 0; i < n; i++) {
    const a0 = (i * TAU) / n, a1 = ((i + 1) * TAU) / n;
    piece(buf, r * cos(a0), y, r * sin(a0), r * cos(a1), y, r * sin(a1), c, a);
  }
}

export function setup(params) {
  // The breath opens on a waist, a third of the way from cylinder to cone.
  params.s = { buf: new Float32Array(W * H * 3), mask: new Float32Array(W * H * 3), breath: 1.16, spin: 0.3, hue: 0, rods: 16, w1: 1, w2: 0.94 };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.rods = round(cl(k[2] || 16, 16, 48));
  const r = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  S.w1 = min(1, 1 + r);
  S.w2 = min(1, 1 - r);
  S.breath = (S.breath + (d * speed * TAU) / 24) % TAU;
  S.spin = (S.spin + (d * speed * TAU) / 40) % TAU;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf;
  buf.fill(0);
  const theta = PI * (0.5 - 0.5 * cos(S.breath));
  const c1 = hsv(S.hue + 0.57, 0.7, 1), c2 = hsv(S.hue + 0.78, 0.6, 1), cw = hsv(S.hue + 0.13, 0.4, 1);
  const n = S.rods, lit = 1.35;

  for (let i = 0; i < n; i++) {
    const p = S.spin + (i * TAU) / n, bx = cos(p), bz = sin(p);
    if (S.w1 > 0.004) piece(buf, bx, -HH, bz, cos(p + theta), HH, sin(p + theta), c1, lit * S.w1);
    if (S.w2 > 0.004) piece(buf, bx, -HH, bz, cos(p - theta), HH, sin(p - theta), c2, lit * S.w2);
  }

  // The two circles the rods hang between, and the waist they pull in to.
  const pale = [(c1[0] + c2[0]) * 0.5, (c1[1] + c2[1]) * 0.5, (c1[2] + c2[2]) * 0.5];
  ring(buf, 1, HH, pale, 0.7);
  ring(buf, 1, -HH, pale, 0.7);

  // The waist ring is laid over the rods rather than added to them, so it
  // keeps its own colour where the lattice is thickest.
  const m = S.mask;
  m.fill(0);
  ring(m, cos(theta / 2), 0, ONE, 2.2);
  for (let i = 0; i < W * H; i++) {
    const a = cl(m[i * 3], 0, 1), p = i * 3;
    display.setPixel(
      i % W,
      floor(i / W),
      round(cl(buf[p] + (cw[0] * a * 1.6 - buf[p]) * a, 0, 1) * 255),
      round(cl(buf[p + 1] + (cw[1] * a * 1.6 - buf[p + 1]) * a, 0, 1) * 255),
      round(cl(buf[p + 2] + (cw[2] * a * 1.6 - buf[p + 2]) * a, 0, 1) * 255),
    );
  }
}
