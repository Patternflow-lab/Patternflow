// ===== Patternflow pattern =====
// Title:   Kendall's Shape Sphere
// Family:  space
// Idea:    A triangle with three coloured corners drifts at random in the top half, held to one size about one centre, and in the bottom half a glass sphere slowly turns with the triangle's shape on it as a white point dragging a four-second trail: the white equator holds every flat triangle, the two poles the two equilateral ones, three meridians in the corners' colours the isosceles ones, and a dust of shapes of random triangles lies evenly over the whole glass, as Kendall proved it must.
// Author:  patternflow-lab
// Date:    2026-11-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the shape space of triangles (David G. Kendall, Shape manifolds, Procrustean metrics, and complex projective spaces, 1984), reached through Helmert's coordinates (Friedrich Robert Helmert, 1876) and the map from the complex projective line to the sphere, pattern round 83
// Round:   83
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Motion=0..1, Dust=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 corner 1 is azure, corner 2 pink and corner 3 yellow-green, each isosceles meridian takes the colour of the corner at its apex, the glass is violet over the triangles whose corners run 1, 2, 3 anticlockwise on the panel and sea green over the clockwise ones, and the equator, the poles and the point stay white.
// Knob 2: Speed. How fast the corners move and the sphere turns. At 2 a corner forgets where it was heading in about a second and the sphere turns once in 31 s; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Motion. From smooth to rough. At 0 each corner moves like a spring shaken by noise and the point draws a smooth curve; at 1 each corner takes a random walk pulled back to the middle and the point jumps about in a jagged scrawl. At every setting the three corners are three independent Gaussian points at any moment, so the point spends equal time on equal areas of the glass whatever the knob.
// Knob 4: Dust. How many random triangles show their shapes on the glass, each glowing for 4 to 8 s before a new one replaces it: none at 0, 291 at the opening 0.06, 2400 at 1, where the glass is evenly frosted from pole to equator.

// David Kendall's shape space. Take three labelled points in the plane and
// forget where they are, which way they face and how big they are. What is
// left is their shape, and the shapes of triangles form a sphere: with
// Kendall's Procrustes distance a sphere of radius 1/2, drawn here as a
// unit sphere, every distance doubled. The flat triangles fill a great
// circle, the equator. The two equilateral triangles, one with its corners
// anticlockwise and one clockwise, are its poles, and every other triangle
// has its mirror image straight across the equator. A triangle with two
// equal sides lies on one of three great circles through the poles, one for
// each corner at the apex; each of those meets the equator where that
// corner sits halfway between the other two and, opposite, where the other
// two coincide. And if the three corners are independent Gaussian points,
// the shape is uniform on the sphere: Kendall's theorem, which the dust
// shows and the point's long run obeys.
//
// The triangle at the top is drawn the way the sphere sees it: centroid
// fixed, size fixed, turning left free. The faint circle round it is the
// farthest a corner can go, reached only when the other two corners meet.
// On the glass, the right-angled triangles lie on three small circles 60
// degrees round each "corner at the midpoint" point, and the blunt triangles
// inside them are shaded dimmer than the sharp ones round the poles.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, log, round, PI } = Math;
const TAU = 2 * PI, SQ2 = sqrt(2), SQ6 = sqrt(6);
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The triangle's box: its centroid sits at (TX, TY) and its corners keep a
// root mean square distance TR from it, so no corner is ever more than
// TR * sqrt(2) = 26.9 LEDs out.
const TX = 32, TY = 31, TR = 19;
// The sphere: centre, radius on the panel, the eye's distance in radii and
// how far the north pole leans towards the eye.
const SX = 31.5, SY = 95, SR = 29, DIST = 3.4, TILT = 0.6;
const FOC = SR * sqrt(DIST * DIST - 1);
// Seconds of trail behind the shape point and behind each corner, the most
// dust, and a ring buffer long enough for the trail at 30 frames a second.
const TRAIL = 4, CTRAIL = 1.5, NDUST = 2400, RB = 256;
const HUE0 = 0.55;

function hsv(h, s, v, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  o[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  o[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  o[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return o;
}

function gauss() {
  const u = Math.random() || 1e-9;
  return sqrt(-2 * log(u)) * cos(TAU * Math.random());
}

// A triangle z = [x1, y1, x2, y2, x3, y3] to its point on the sphere.
// Helmert's coordinates a = (z2 - z1) / sqrt 2 and b = (2 z3 - z1 - z2) / sqrt 6
// take out the centroid; the ratio a : b of the two complex numbers takes
// out size and turning; and (|a|^2 - |b|^2, 2 a conj(b)) over |a|^2 + |b|^2
// lays that ratio on the unit sphere. The last coordinate is minus the
// signed area over the squared size, times 4 / sqrt 3: 0 for a flat
// triangle, +1 or -1 for the two equilateral ones.
function kendall(z, o) {
  const ax = (z[2] - z[0]) / SQ2, ay = (z[3] - z[1]) / SQ2;
  const bx = (2 * z[4] - z[0] - z[2]) / SQ6, by = (2 * z[5] - z[1] - z[3]) / SQ6;
  const aa = ax * ax + ay * ay, bb = bx * bx + by * by, n = aa + bb;
  if (n < 1e-12) return false;
  o[0] = (aa - bb) / n;
  o[1] = (2 * (ax * bx + ay * by)) / n;
  o[2] = (2 * (ay * bx - ax * by)) / n;
  return true;
}

function dustOne(S, i, z, q) {
  for (let j = 0; j < 6; j++) z[j] = gauss();
  if (!kendall(z, q)) return;
  S.dx[i] = q[0];
  S.dy[i] = q[1];
  S.dz[i] = q[2];
}

export function setup(params) {
  const S = {
    hue: 0, speed: 2, motion: 0, dust: 0.06, spin: 0.6,
    xs: new Float64Array(6), vs: new Float64Array(6), xr: new Float64Array(6), z: new Float64Array(6), p: [0, 0, 1],
    // Ring buffer: the shape point, the three corners on the panel, age.
    tx: new Float32Array(RB), ty: new Float32Array(RB), tz: new Float32Array(RB), tc: new Float32Array(RB * 6), ta: new Float32Array(RB), th: 0, tn: 0,
    dx: new Float32Array(NDUST), dy: new Float32Array(NDUST), dz: new Float32Array(NDUST), dage: new Float32Array(NDUST), dlife: new Float32Array(NDUST),
    R: new Float32Array(N), G: new Float32Array(N), B: new Float32Array(N),
    mid: [], zz: new Float64Array(6), q: [0, 0, 0],
  };
  for (let i = 0; i < 6; i++) {
    S.xs[i] = gauss();
    S.vs[i] = gauss() * 1.1;
    S.xr[i] = gauss();
  }
  for (let i = 0; i < NDUST; i++) {
    S.dz[i] = 1;
    dustOne(S, i, S.zz, S.q);
    S.dlife[i] = 4 + 4 * Math.random();
    S.dage[i] = Math.random() * S.dlife[i];
  }
  // Corner k's isosceles meridian runs through the longitude of any triangle
  // with corner k over the middle of the other two. Measured from a blunt
  // one, the direction points at the flat triangle with corner k at the
  // midpoint; the far end of the same meridian is the one where the other
  // two corners meet.
  for (let k = 0; k < 3; k++) {
    const iso = [0, 0, 0, 0, 0, 0], q = S.q;
    iso[2 * k + 1] = -0.8;
    iso[2 * ((k + 1) % 3)] = -1;
    iso[2 * ((k + 2) % 3)] = 1;
    kendall(iso, q);
    const l = sqrt(q[0] * q[0] + q[1] * q[1]);
    S.mid.push([q[0] / l, q[1] / l]);
  }
  params.s = S;
}

// One step of the corners. Each of the six coordinates is the blend
// cos(m) x + sin(m) y of two independent processes that are each a standard
// normal at every moment: x a critically damped oscillator shaken by noise,
// smooth, and y an Ornstein-Uhlenbeck walk, rough. The blend is a standard
// normal too, so at any moment the three corners are independent Gaussian
// points, and Kendall's theorem says their shape is then uniform on the
// sphere: the trail wanders everywhere evenly whatever the knob.
function step(S, h) {
  const w = 1.1, q = sqrt(4 * w * w * w * h), rt = 1.2, rq = sqrt((2 * h) / rt);
  for (let i = 0; i < 6; i++) {
    S.vs[i] += (-w * w * S.xs[i] - 2 * w * S.vs[i]) * h + q * gauss();
    S.xs[i] += S.vs[i] * h;
    S.xr[i] += (-S.xr[i] / rt) * h + rq * gauss();
  }
}

// The corners on the panel: centroid at (TX, TY), root mean square radius TR.
function corners(z, o) {
  const cx = (z[0] + z[2] + z[4]) / 3, cy = (z[1] + z[3] + z[5]) / 3;
  let ss = 0;
  for (let k = 0; k < 3; k++) ss += (z[2 * k] - cx) ** 2 + (z[2 * k + 1] - cy) ** 2;
  const sc = TR / sqrt(ss / 3 + 1e-12);
  for (let k = 0; k < 3; k++) {
    o[2 * k] = TX + (z[2 * k] - cx) * sc;
    o[2 * k + 1] = TY + (z[2 * k + 1] - cy) * sc;
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  S.speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.motion = cl(k[2] || 0, 0, 1);
  S.dust = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const sim = d * S.speed * 0.5;
  S.spin = (S.spin + sim * 0.2) % TAU;
  for (let left = sim; left > 1e-9; left -= 0.02) step(S, min(0.02, left));
  const m = (S.motion * PI) / 2, cm = cos(m), sm = sin(m);
  for (let i = 0; i < 6; i++) S.z[i] = cm * S.xs[i] + sm * S.xr[i];
  kendall(S.z, S.p);

  for (let i = 0; i < S.tn; i++) S.ta[(S.th - 1 - i + RB) % RB] += d;
  const j = S.th;
  S.tx[j] = S.p[0];
  S.ty[j] = S.p[1];
  S.tz[j] = S.p[2];
  S.ta[j] = 0;
  corners(S.z, S.tc.subarray(j * 6, j * 6 + 6));
  S.th = (j + 1) % RB;
  S.tn = min(S.tn + 1, RB - 1);
  while (S.tn > 1 && S.ta[(S.th - S.tn + RB) % RB] > TRAIL) S.tn--;

  // Dust: random triangles, each glowing for 4 to 8 s and then replaced.
  for (let i = 0; i < NDUST; i++) {
    S.dage[i] += sim;
    if (S.dage[i] > S.dlife[i]) {
      dustOne(S, i, S.zz, S.q);
      S.dage[i] -= S.dlife[i];
    }
  }
}

// Shape coordinates to the eye's: turn about the polar axis, then lean the
// north pole towards the eye. z points at the eye.
function toEye(S, X, Y, Z, o) {
  const cs = cos(S.spin), sn = sin(S.spin);
  const x = X * cs - Y * sn, y = X * sn + Y * cs;
  o[0] = x;
  o[1] = Z * cos(TILT) - y * sin(TILT);
  o[2] = Z * sin(TILT) + y * cos(TILT);
  return o;
}

// The eye's coordinates to the panel, and how much light a point keeps:
// all of it on the front of the glass, a third on the back.
function project(e, o) {
  const s = FOC / (DIST - e[2]);
  o[0] = SX + e[0] * s;
  o[1] = SY - e[1] * s;
  o[2] = 0.33 + 0.67 * cl((e[2] - 1 / DIST + 0.12) / 0.24, 0, 1);
  return o;
}

function splat(S, x, y, r, g, b) {
  x -= 0.5;
  y -= 0.5;
  const ix = floor(x), iy = floor(y), fx = x - ix, fy = y - iy;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = ix + i, py = iy + j;
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const w = (i ? fx : 1 - fx) * (j ? fy : 1 - fy), o = py * W + px;
      S.R[o] += r * w;
      S.G[o] += g * w;
      S.B[o] += b * w;
    }
}

// A line from colour a to colour b, about one LED of light per LED of length.
function line(S, x0, y0, x1, y1, a, b) {
  const n = max(1, ceil(sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) * 2));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, u = 1 - t;
    splat(S, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (a[0] * u + b[0] * t) * 0.5, (a[1] * u + b[1] * t) * 0.5, (a[2] * u + b[2] * t) * 0.5);
  }
}

// The great circle through the perpendicular unit vectors u and v.
function circle(S, u, v, col, lev) {
  const e = [0, 0, 0], a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], M = 160;
  for (let i = 0; i <= M; i++) {
    const t = (i / M) * TAU, cs = cos(t), sn = sin(t);
    toEye(S, u[0] * cs + v[0] * sn, u[1] * cs + v[1] * sn, u[2] * cs + v[2] * sn, e);
    project(e, b);
    if (i > 0) {
      const l = (lev * (a[2] + b[2])) / 2;
      c[0] = col[0] * l;
      c[1] = col[1] * l;
      c[2] = col[2] * l;
      line(S, a[0], a[1], b[0], b[1], c, c);
    }
    a[0] = b[0];
    a[1] = b[1];
    a[2] = b[2];
  }
}

// A small filled triangle centred at (x, y), pointing up (dir 1) or down.
function mark(S, x, y, s, dir, l) {
  for (let py = floor(y - s); py <= y + s; py++)
    for (let px = floor(x - s); px <= x + s; px++) {
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      let cov = 0;
      for (let k = 0; k < 4; k++) {
        const u = px + 0.25 + (k & 1) * 0.5 - x, v = (py + 0.25 + (k >> 1) * 0.5 - y) * dir;
        if (v <= s * 0.5 && v >= -s && abs(u) <= (v + s) * 0.577) cov += 0.25;
      }
      const o = py * W + px;
      S.R[o] += l * cov;
      S.G[o] += l * cov;
      S.B[o] += l * cov;
    }
}

function disc(S, x, y, rad, col, l, over) {
  for (let py = floor(y - rad - 1); py <= y + rad + 1; py++)
    for (let px = floor(x - rad - 1); px <= x + rad + 1; px++) {
      if (px < 0 || px >= W || py < 0 || py >= H) continue;
      const d = sqrt((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2), w = cl(rad + 0.5 - d, 0, 1);
      if (w <= 0) continue;
      const o = py * W + px, k = over ? 1 - w : 1;
      S.R[o] = S.R[o] * k + col[0] * l * w;
      S.G[o] = S.G[o] * k + col[1] * l * w;
      S.B[o] = S.B[o] * k + col[2] * l * w;
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const R = S.R, G = S.G, B = S.B, h = S.hue + HUE0;
  R.fill(0);
  G.fill(0);
  B.fill(0);
  const vc = [0, 1, 2].map((k) => hsv(h + k / 3, 0.8, 1, [0, 0, 0]));
  const north = hsv(h + 0.15, 0.7, 1, [0, 0, 0]), south = hsv(h - 0.08, 0.7, 1, [0, 0, 0]), white = [1, 1, 1];
  const ct = cos(TILT), st = sin(TILT), cs = cos(S.spin), sn = sin(S.spin), mid = S.mid;

  // The glass. Its front is tinted by which way round its triangles run and
  // is brighter the further they are from flat; the three caps of blunt
  // triangles, inside the circles of right-angled ones, are dimmer.
  for (let y = floor(SY - SR - 1); y <= SY + SR + 1; y++)
    for (let x = floor(SX - SR - 1); x <= SX + SR + 1; x++) {
      const qx = (x + 0.5 - SX) / FOC, qy = -(y + 0.5 - SY) / FOC, qq = qx * qx + qy * qy + 1;
      // The ray from the eye at (0, 0, DIST) along (qx, qy, -1).
      const disc2 = DIST * DIST - qq * (DIST * DIST - 1);
      if (disc2 <= 0) continue;
      const t = (DIST - sqrt(disc2)) / qq, ex = qx * t, ey = qy * t, ez = DIST - t;
      const Z = ey * ct + ez * st, yy = -ey * st + ez * ct, X = ex * cs + yy * sn, Y = -ex * sn + yy * cs;
      let blunt = false;
      for (let k = 0; k < 3; k++) if (X * mid[k][0] + Y * mid[k][1] > 0.5) blunt = true;
      const a = abs(Z), col = Z > 0 ? north : south, lev = (24 + 80 * a * a) * (blunt ? 0.55 : 1), o = y * W + x;
      R[o] += col[0] * lev;
      G[o] += col[1] * lev;
      B[o] += col[2] * lev;
    }

  // Dust.
  const nd = round(NDUST * S.dust ** 0.75), e = [0, 0, 0], p = [0, 0, 0];
  for (let i = 0; i < nd; i++) {
    const f = sin((PI * S.dage[i]) / S.dlife[i]);
    toEye(S, S.dx[i], S.dy[i], S.dz[i], e);
    project(e, p);
    const l = 120 * f * p[2];
    splat(S, p[0], p[1], 0.85 * l, 0.92 * l, l);
  }

  // The equator, every flat triangle; the three isosceles meridians; the
  // two equilateral triangles at the poles.
  circle(S, [1, 0, 0], [0, 1, 0], [0.92, 0.95, 1], 150);
  for (let k = 0; k < 3; k++) circle(S, [mid[k][0], mid[k][1], 0], [0, 0, 1], vc[k], 125);
  for (const z of [1, -1]) {
    toEye(S, 0, 0, z, e);
    project(e, p);
    mark(S, p[0], p[1], 2.6, z, 255 * p[2]);
  }

  // The shape point's trail, white fading into its hemisphere's colour.
  const tc = S.tc;
  let px = 0, py = 0;
  const ca = [0, 0, 0], cb = [0, 0, 0];
  for (let i = S.tn - 1; i >= 0; i--) {
    const j = (S.th - 1 - i + RB) % RB, f = 1 - S.ta[j] / TRAIL;
    toEye(S, S.tx[j], S.ty[j], S.tz[j], e);
    project(e, p);
    const tint = S.tz[j] > 0 ? north : south, l = 230 * f * p[2];
    for (let c = 0; c < 3; c++) cb[c] = l * (f + (1 - f) * tint[c]);
    if (i < S.tn - 1) line(S, px, py, p[0], p[1], ca, cb);
    px = p[0];
    py = p[1];
    ca[0] = cb[0];
    ca[1] = cb[1];
    ca[2] = cb[2];
  }
  toEye(S, S.p[0], S.p[1], S.p[2], e);
  project(e, p);
  // Filled on the front of the glass, a ring on the back.
  disc(S, p[0], p[1], 3.2, white, 0, true);
  disc(S, p[0], p[1], 2.2, white, 255, true);
  if (p[2] < 0.6) disc(S, p[0], p[1], 0.9, white, 0, true);

  // The circle a corner reaches only when the other two meet.
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * TAU;
    splat(S, TX + TR * SQ2 * cos(a), TY + TR * SQ2 * sin(a), 26, 30, 40);
  }

  // The corners' trails over the last CTRAIL seconds.
  for (let i = S.tn - 2; i >= 0; i--) {
    const j = (S.th - 1 - i + RB) % RB, j0 = (j - 1 + RB) % RB, age = S.ta[j];
    if (age > CTRAIL) continue;
    const l = 110 * (1 - age / CTRAIL);
    for (let k = 0; k < 3; k++) {
      for (let c = 0; c < 3; c++) ca[c] = vc[k][c] * l;
      line(S, tc[j0 * 6 + 2 * k], tc[j0 * 6 + 2 * k + 1], tc[j * 6 + 2 * k], tc[j * 6 + 2 * k + 1], ca, ca);
    }
  }

  // The triangle, filled with its hemisphere's colour.
  const j = (S.th - 1 + RB) % RB, v = tc.subarray(j * 6, j * 6 + 6);
  const Zp = S.p[2], fcol = Zp > 0 ? north : south, flev = 40 + 120 * abs(Zp);
  const ar = (v[2] - v[0]) * (v[5] - v[1]) - (v[3] - v[1]) * (v[4] - v[0]);
  if (abs(ar) > 1e-6) {
    const x0 = max(0, floor(min(v[0], v[2], v[4]))), x1 = min(W - 1, floor(max(v[0], v[2], v[4])));
    const y0 = max(0, floor(min(v[1], v[3], v[5]))), y1 = min(H - 1, floor(max(v[1], v[3], v[5])));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        let cov = 0;
        for (let k = 0; k < 4; k++) {
          const sx = x + 0.25 + (k & 1) * 0.5, sy = y + 0.25 + (k >> 1) * 0.5;
          const w0 = ((v[2] - sx) * (v[5] - sy) - (v[3] - sy) * (v[4] - sx)) / ar;
          const w1 = ((v[4] - sx) * (v[1] - sy) - (v[5] - sy) * (v[0] - sx)) / ar;
          if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) cov += 0.25;
        }
        const o = y * W + x;
        R[o] += fcol[0] * flev * cov;
        G[o] += fcol[1] * flev * cov;
        B[o] += fcol[2] * flev * cov;
      }
  }
  for (let k = 0; k < 3; k++) {
    const n = (k + 1) % 3;
    for (let c = 0; c < 3; c++) {
      ca[c] = vc[k][c] * 210;
      cb[c] = vc[n][c] * 210;
    }
    line(S, v[2 * k], v[2 * k + 1], v[2 * n], v[2 * n + 1], ca, cb);
  }
  for (let k = 0; k < 3; k++) disc(S, v[2 * k], v[2 * k + 1], 2.3, vc[k], 255, true);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = y * W + x;
      display.setPixel(x, y, min(255, round(R[o])), min(255, round(G[o])), min(255, round(B[o])));
    }
}
