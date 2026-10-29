// ===== Patternflow pattern =====
// Title:   Dupin Cyclide
// Family:  geometry
// Idea:    A torus turns at the top of the panel and below it its image under an inversion in a sphere turns with it, a Dupin cyclide drawn as the two families of circles that are its lines of curvature, every torus circle landing on a circle, while a band of light runs round both families on both surfaces at once.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dupin cyclides (Charles Dupin, 1822), the surfaces whose lines of curvature are all circles, each the image of a torus, a circular cylinder or a circular cone under an inversion in a sphere; pattern round 67
// Round:   67
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..2, Distance=0..1
//
// Knob 1: Hue. Turns both families round the wheel together: at 0 the circles round the tube are cyan and the circles round the hole rose.
// Knob 2: Speed. How fast the pair turns and the band of light runs: one turn in 11 seconds at 2, in 112 at 0.2.
// Knob 3: Shape. The torus tube against its centre circle, and so the cyclide's type: a ring torus and ring cyclide at 0 (tube half the radius), the horn pair at 1 where the hole closes to a point, and spindle pairs up to 2 where the tube is 1.6 times the radius and the surface passes through itself.
// Knob 4: Distance. The gap between the torus and the centre of inversion below it, in outer radii of the torus: 1.2 at 0 and 1.45 at the opening 0.06, where the cyclide's tube is 3.1 times as thick at the bottom as at the top, out to 29 at 1, where the image is the torus again to within 9 per cent.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, cos, sin, exp, PI, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}

// The torus: centre circle radius 1 in the plane z = 0, centred at (0, d, 0),
// so it stands on edge facing the viewer, and the centre of inversion is the
// origin, d below it. Meridians (u fixed, round the tube) and parallels (v
// fixed, round the hole) are its two families of lines of curvature.
const NU = 18, NV = 10, K = 60;
// Panel boxes: the torus above, the cyclide below.
const TOP = [1, 57], BOT = [63, 126], BW = 61;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// The circle through three points: centre, radius and an orthonormal pair
// spanning its plane.
function circleThrough(A, B, C) {
  const a = sub(A, C), b = sub(B, C), n = cross(a, b), nn = dot(n, n);
  const c = add(C, scale(cross(sub(scale(b, dot(a, a)), scale(a, dot(b, b))), n), 1 / (2 * nn)));
  const e1 = sub(A, c), rad = sqrt(dot(e1, e1));
  const u = scale(e1, 1 / rad), w = cross(scale(n, 1 / sqrt(nn)), u);
  return { c, rad, u, w };
}

// One circle of the torus, as centre, radius and plane.
function torusCircle(fam, i, r, d, us) {
  if (fam === 0) {
    const u = us[i];
    return { c: [cos(u), d + sin(u), 0], rad: r, u: [cos(u), sin(u), 0], w: [0, 0, 1] };
  }
  const v = (i / NV) * TAU;
  return { c: [0, d, r * sin(v)], rad: 1 + r * cos(v), u: [1, 0, 0], w: [0, 1, 0] };
}
const onCircle = (C, t) => add(C.c, add(scale(C.u, C.rad * cos(t)), scale(C.w, C.rad * sin(t))));
// The inversion in the sphere of radius d about the origin, followed by the
// point reflection through it (an anti-inversion), so the image hangs below
// the centre the way the torus stands above it. Spheres go to spheres and
// circles to circles either way.
const invert = (p, k2) => scale(p, -k2 / dot(p, p));

function build(S) {
  const r = S.r, d = (1 + r) * (1 + S.del), k2 = d * d;
  // Where the meridians sit. The inversion stretches the side of the torus
  // nearest the centre k2 / |p|^2 times, so meridians evenly spaced on the
  // torus crowd on the image's thin side. Spacing them evenly in the square
  // root of that stretch splits the crowding between the two surfaces, and
  // the torus shows where the inversion pulls hardest.
  const F = [0];
  for (let j = 1; j <= 720; j++) {
    const u = -PI / 2 + ((j - 0.5) / 720) * TAU, q = cos(u) ** 2 + (d + sin(u)) ** 2;
    F[j] = F[j - 1] + sqrt(k2 / q);
  }
  const us = [];
  for (let i = 0, j = 0; i < NU; i++) {
    const want = (i / NU) * F[720];
    while (F[j + 1] < want) j++;
    us.push(-PI / 2 + ((j + (want - F[j]) / (F[j + 1] - F[j] || 1)) / 720) * TAU);
  }
  const objs = [[], []];
  for (let fam = 0; fam < 2; fam++)
    for (let i = 0; i < (fam ? NV : NU); i++) {
      const T = torusCircle(fam, i, r, d, us);
      // A horn torus has a parallel of radius 0 where the hole closes, a
      // point: there is no circle to draw.
      if (abs(T.rad) < 1e-3) continue;
      objs[0].push({ fam, i, C: T });
      // The image of a circle is a circle, so three image points fix it.
      const P = [0, 1, 2].map((j) => invert(onCircle(T, (j * TAU) / 3 + 0.3), k2));
      objs[1].push({ fam, i, C: circleThrough(P[0], P[1], P[2]) });
    }
  // Sample every circle and fit each surface to its box. The turn is about
  // the vertical axis, and a half turn about it maps each surface onto
  // itself, so the drawing is never wider than twice the largest distance
  // from that axis.
  S.objs = objs.map((list, o) => {
    let ylo = 1e9, yhi = -1e9, rad = 0;
    const pts = list.map(({ C }) => {
      const a = new Float32Array(K * 3);
      for (let j = 0; j < K; j++) {
        const p = onCircle(C, (j / K) * TAU);
        a.set(p, j * 3);
        ylo = min(ylo, p[1]);
        yhi = max(yhi, p[1]);
        rad = max(rad, hypot(p[0], p[2]));
      }
      return a;
    });
    const box = o ? BOT : TOP;
    const s = min(BW / (2 * rad), (box[1] - box[0]) / (yhi - ylo));
    return { list, pts, s, rad, ym: (ylo + yhi) / 2, cy: (box[0] + box[1]) / 2 };
  });
}

export function setup(params) {
  params.s = { phi: 0.5, band: 0, key: "", R: new Float32Array(W * H), G: new Float32Array(W * H), B: new Float32Array(W * H) };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06];
  dt = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1], 0.2, 3);
  S.phi += dt * speed * 0.28;
  S.band += dt * speed * 1.1;
  // Shape: tube over centre radius 0.5 (ring) to 1 (horn) to 1.6 (spindle).
  const sh = cl(k[2], 0, 2);
  S.r = sh <= 1 ? 0.5 + 0.5 * sh : 1 + 0.6 * (sh - 1);
  // Distance: the gap between the torus and the centre, in outer radii.
  S.del = 1.2 * exp(3.2 * cl(k[3], 0, 1));
  const key = S.r.toFixed(4) + "," + S.del.toFixed(4);
  if (key !== S.key) {
    S.key = key;
    build(S);
  }
}

// An antialiased line one LED wide, kept as the brightest colour per LED.
function line(S, x0, y0, x1, y1, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy;
  const xa = max(0, floor(min(x0, x1) - 1)), xb = min(W - 1, floor(max(x0, x1) + 1));
  const ya = max(0, floor(min(y0, y1) - 1)), yb = min(H - 1, floor(max(y0, y1) + 1));
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const px = x - x0, py = y - y0;
      const t = L ? cl((px * dx + py * dy) / L, 0, 1) : 0;
      const ex = px - t * dx, ey = py - t * dy;
      const a = cl(1.05 - sqrt(ex * ex + ey * ey), 0, 1);
      if (a <= 0) continue;
      const p = y * W + x;
      if (r * a > S.R[p]) S.R[p] = r * a;
      if (g * a > S.G[p]) S.G[p] = g * a;
      if (b * a > S.B[p]) S.B[p] = b * a;
    }
}

export function draw(display, params) {
  if (!params.s || !params.s.objs) return;
  const S = params.s;
  S.R.fill(0);
  S.G.fill(0);
  S.B.fill(0);
  const cphi = cos(S.phi), sphi = sin(S.phi);
  const cols = [hsv(S.hue + 0.5, 0.8, 1), hsv(S.hue + 0.88, 0.62, 1)];
  const sx = [], sy = [], sz = [];
  S.objs.forEach((O, o) => {
    const dim = o ? 1 : 0.8;
    O.list.forEach(({ fam, i }, n) => {
      const a = O.pts[n];
      // The band of light: a soft bump running round each family's index,
      // the same circles lit on the torus and on its image.
      const N = fam ? NV : NU;
      let g = (i - S.band * (fam ? 0.5 : 1)) % N;
      if (g < 0) g += N;
      g = min(g, N - g);
      const hl = exp(-g * g * 0.8);
      const col = cols[fam];
      for (let j = 0; j < K; j++) {
        const x = a[j * 3], y = a[j * 3 + 1], z = a[j * 3 + 2];
        const xr = x * cphi + z * sphi, zr = -x * sphi + z * cphi;
        sx[j] = W / 2 + xr * O.s;
        sy[j] = O.cy - (y - O.ym) * O.s;
        sz[j] = zr / O.rad;
      }
      for (let j = 0; j < K; j++) {
        const q = (j + 1) % K;
        // Depth: the near side bright, the far side down to a fifth.
        const depth = cl(0.5 + 0.25 * (sz[j] + sz[q]), 0, 1);
        const v = dim * (0.1 + 0.9 * depth * depth) * (0.75 + 0.25 * hl);
        const wv = 0.55 * hl * depth;
        line(S, sx[j], sy[j], sx[q], sy[q], 255 * v * (col[0] * (1 - wv) + wv), 255 * v * (col[1] * (1 - wv) + wv), 255 * v * (col[2] * (1 - wv) + wv));
      }
    });
  });
  for (let p = 0; p < W * H; p++) {
    if (S.R[p] + S.G[p] + S.B[p] < 1) continue;
    display.setPixel(p % W, floor(p / W), min(255, S.R[p]) | 0, min(255, S.G[p]) | 0, min(255, S.B[p]) | 0);
  }
}
