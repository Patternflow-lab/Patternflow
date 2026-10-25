// ===== Patternflow pattern =====
// Title:   Kaleidocycle
// Family:  space
// Idea:    A closed ring of six tetrahedra joined edge to edge by hinges turns through itself without end, seen from the front in the top half of the panel and from behind in the bottom half, every piece tumbling over in its place so the hexagon of faces on each side changes colour through four face sets.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: kaleidocycles (Wallace Walker, 1958), pattern round 43
// Round:   43
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tetrahedra=6..12, Tilt=0..1
//
// Knob 1: Hue. Turns the four face sets' colours round the wheel together. At 0 they are gold, green, azure and magenta; a set that comes round to orange or yellow is paled and lit higher, so it never reads brown.
// Knob 2: Speed. At 2 the ring turns a quarter in 2.6 seconds, every piece rolls a quarter over and the next face set comes to the front; after 10.5 seconds all four sets have had their turn and it is back where it started. At 0.2 a quarter takes 26 seconds, at 3 it takes 1.7.
// Knob 3: Tetrahedra, 6 to 12 in steps of 2. 6 is the hexagonal ring of the paper models, here six isosceles tetrahedra whose faces are as tall as their hinge edge is long, the fattest six that still turn all the way: neighbours close face to face at the end of each swing. Six regular tetrahedra would run into each other; 8, 10 and 12 are rings of regular ones, each a wider hoop with a bigger hole.
// Knob 4: Tilt. How far both views look off the ring's axis, 10 degrees at 0 and 70 at 1. At 0 each view is a hexagon of six faces round a hole that opens into a three-pointed star; at 1 both look at the ring from 20 degrees off its side, where the pieces tumble as wedges and the face set on the outer wall comes into view.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, sin, cos, acos, atan2, round, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The light, a unit vector toward it: from the upper left, in front.
const LX = -0.48, LY = -0.62, LZ = -0.62;
// The camera sits this many ring radii in front of the ring's centre.
const CAM = 4.2;
// The two views: centre row on the panel, and which side of the ring.
const VIEWS = [[32, 1], [96, -1]];

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, n: 6, tilt: 0.06, phase: 0,
    // Hinge midpoints p_i and hinge directions z_i, i = 0..N, as the chain
    // builds them; the tetrahedra's corners about the ring's centre, axis
    // first; and the same corners on the panel for one view.
    p: new Float64Array(13 * 3), z: new Float64Array(13 * 3),
    v: new Float64Array(12 * 4 * 3), sv: new Float64Array(12 * 4 * 3), P: new Float64Array(12 * 4 * 3),
    fitKey: "", scale: 1, radius: 1, gap: 0,
    id: new Int16Array(W * H), cs: new Uint8Array(W * H), zb: new Float32Array(W * H), sh: new Float32Array(W * H),
    col: new Float32Array(12), colHue: NaN, warm: new Float32Array(4),
  };
}

// The joint angles of the turning ring. Hinge i is where tetrahedra i - 1
// and i meet, and going from one tetrahedron's common perpendicular to the
// next one's turns theta_i about it. Every tetrahedron holds its two hinges
// at right angles, 1 apart, each crossed at its middle by the perpendicular
// between them. The ring turns with theta = A, B, -A, -B, A, B, ... and is
// closed exactly when cos(A/2) cos(B/2) = cos(2 pi / N); phi walks once
// round that loop, and a quarter of it hands each tetrahedron's place and
// pose to its neighbour.
function angles(n, phi) {
  const c = cos(TAU / n), s = sin(phi) ** 2;
  const u = acos(pow(c, s)) * (sin(phi) < 0 ? -1 : 1), w = acos(pow(c, 1 - s)) * (cos(phi) < 0 ? -1 : 1);
  return [2 * u, 2 * w];
}

// Build the chain from hinge 0 with Denavit-Hartenberg steps: 1 along the
// common perpendicular x, a quarter turn about it, then theta about the new
// hinge. The frame (x, y, z) at hinge i + 1 is c x + s z, -s x + c z, -y.
function chain(S, n, phi) {
  const [A, B] = angles(n, phi), th = [A, B, -A, -B];
  const { p, z } = S;
  let x0 = 1, x1 = 0, x2 = 0, y0 = 0, y1 = 1, y2 = 0, z0 = 0, z1 = 0, z2 = 1, q0 = 0, q1 = 0, q2 = 0;
  for (let i = 0; i <= n; i++) {
    (p[3 * i] = q0), (p[3 * i + 1] = q1), (p[3 * i + 2] = q2);
    (z[3 * i] = z0), (z[3 * i + 1] = z1), (z[3 * i + 2] = z2);
    const t = th[(i + 1) % 4], c = cos(t), s = sin(t);
    (q0 += x0), (q1 += x1), (q2 += x2);
    const a0 = c * x0 + s * z0, a1 = c * x1 + s * z1, a2 = c * x2 + s * z2;
    const b0 = -s * x0 + c * z0, b1 = -s * x1 + c * z1, b2 = -s * x2 + c * z2;
    (z0 = -y0), (z1 = -y1), (z2 = -y2);
    (x0 = a0), (x1 = a1), (x2 = a2);
    (y0 = b0), (y1 = b1), (y2 = b2);
  }
  // How far the chain misses its own start: hinge N must lie on hinge 0,
  // pointing the other way when N is 2 more than a multiple of 4.
  const sg = n % 4 === 2 ? -1 : 1;
  S.gap = max(
    sqrt((p[3 * n] - p[0]) ** 2 + (p[3 * n + 1] - p[1]) ** 2 + (p[3 * n + 2] - p[2]) ** 2),
    sqrt((z[3 * n] - sg * z[0]) ** 2 + (z[3 * n + 1] - sg * z[1]) ** 2 + (z[3 * n + 2] - sg * z[2]) ** 2),
  );
}

// Half the hinge edge for N tetrahedra. Neighbours sharing hinge i stay
// apart while 180 - |theta_i| >= 2 atan(a), and |theta| reaches 720 / N
// degrees, so six tetrahedra can be at most tan 30 degrees; from eight on
// they are regular, 1 / sqrt 2.
const halfHinge = (n) => (n === 6 ? 1 / sqrt(3) : 1 / sqrt(2));

// The ring about its centre: the hinge midpoints' mean, the axis along their
// polygon's vector area, turned about the axis so the tetrahedra keep their
// places on average. Each corner is written as (along the axis, and two
// across it).
function place(S, n, phi, out) {
  chain(S, n, phi);
  const { p, z } = S, a = halfHinge(n);
  let c0 = 0, c1 = 0, c2 = 0;
  for (let i = 0; i < n; i++) (c0 += p[3 * i]), (c1 += p[3 * i + 1]), (c2 += p[3 * i + 2]);
  (c0 /= n), (c1 /= n), (c2 /= n);
  let e0 = 0, e1 = 0, e2 = 0;
  for (let i = 0; i < n; i++) {
    const r0 = p[3 * i] - c0, r1 = p[3 * i + 1] - c1, r2 = p[3 * i + 2] - c2;
    const s0 = p[3 * i + 3] - c0, s1 = p[3 * i + 4] - c1, s2 = p[3 * i + 5] - c2;
    (e0 += r1 * s2 - r2 * s1), (e1 += r2 * s0 - r0 * s2), (e2 += r0 * s1 - r1 * s0);
  }
  let l = sqrt(e0 * e0 + e1 * e1 + e2 * e2);
  (e0 /= l), (e1 /= l), (e2 /= l);
  // A first direction across the axis from hinge 0, then the mean turn that
  // puts tetrahedron i at angle 2 pi i / N.
  let u0 = p[0] - c0, u1 = p[1] - c1, u2 = p[2] - c2;
  const d = u0 * e0 + u1 * e1 + u2 * e2;
  (u0 -= d * e0), (u1 -= d * e1), (u2 -= d * e2);
  l = sqrt(u0 * u0 + u1 * u1 + u2 * u2);
  (u0 /= l), (u1 /= l), (u2 /= l);
  const w0 = e1 * u2 - e2 * u1, w1 = e2 * u0 - e0 * u2, w2 = e0 * u1 - e1 * u0;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const g0 = (p[3 * i] + p[3 * i + 3]) / 2 - c0, g1 = (p[3 * i + 1] + p[3 * i + 4]) / 2 - c1, g2 = (p[3 * i + 2] + p[3 * i + 5]) / 2 - c2;
    const az = atan2(g0 * w0 + g1 * w1 + g2 * w2, g0 * u0 + g1 * u1 + g2 * u2) - (TAU * i) / n;
    (sx += cos(az)), (sy += sin(az));
  }
  const rho = atan2(sy, sx) + PI / 2, cr = cos(rho), sr = sin(rho);
  const f0 = cr * u0 + sr * w0, f1 = cr * u1 + sr * w1, f2 = cr * u2 + sr * w2;
  const h0 = -sr * u0 + cr * w0, h1 = -sr * u1 + cr * w1, h2 = -sr * u2 + cr * w2;
  let k = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < 4; j++, k += 3) {
      const m = j < 2 ? i : i + 1, sg = j & 1 ? -a : a;
      const q0 = p[3 * m] + sg * z[3 * m] - c0, q1 = p[3 * m + 1] + sg * z[3 * m + 1] - c1, q2 = p[3 * m + 2] + sg * z[3 * m + 2] - c2;
      out[k] = q0 * e0 + q1 * e1 + q2 * e2;
      out[k + 1] = q0 * f0 + q1 * f1 + q2 * f2;
      out[k + 2] = q0 * h0 + q1 * h1 + q2 * h2;
    }
}

// One view: side 1 looks at the ring from the end its axis points to, side
// -1 from the other end, both tipped off the axis by `off` about the
// panel's vertical. Writes screen x, y about the view's centre and depth.
function view(v, nv, side, off, out) {
  const co = cos(off), so = sin(off);
  for (let k = 0; k < nv; k++) {
    const X = v[3 * k], Y = v[3 * k + 1], Z = v[3 * k + 2];
    const x = side * Z, dz = -side * X;
    out[3 * k] = x * co - dz * so;
    out[3 * k + 1] = Y;
    out[3 * k + 2] = x * so + dz * co;
  }
}

const offAxis = (tilt) => ((10 + 60 * tilt) * PI) / 180;

// The scale that keeps the whole turn inside each half of the panel, from
// 48 poses round the loop, seen through the camera from both sides.
function fit(S) {
  const key = S.n + ":" + S.tilt.toFixed(3);
  if (key === S.fitKey) return;
  const v = S.v, sv = S.sv, nv = S.n * 4, off = offAxis(S.tilt);
  let R = 0, mx = 0, my = 0;
  for (let q = 0; q < 48; q++) {
    place(S, S.n, (q / 48) * TAU, v);
    for (let k = 0; k < nv; k++) R = max(R, sqrt(v[3 * k] ** 2 + v[3 * k + 1] ** 2 + v[3 * k + 2] ** 2));
  }
  for (let q = 0; q < 48; q++) {
    place(S, S.n, (q / 48) * TAU, v);
    for (const [, side] of VIEWS) {
      view(v, nv, side, off, sv);
      for (let k = 0; k < nv; k++) {
        const pf = (CAM * R) / (CAM * R + sv[3 * k + 2]);
        mx = max(mx, abs(sv[3 * k] * pf));
        my = max(my, abs(sv[3 * k + 1] * pf));
      }
    }
  }
  S.radius = R;
  S.scale = min((W / 2 - 1) / mx, (H / 4 - 1) / my);
  S.fitKey = key;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 6, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.n = cl(2 * round(cl(k[2], 6, 12) / 2), 6, 12);
  S.tilt = cl(k[3], 0, 1);
  S.phase += d * S.speed * 0.3;
  fit(S);
}

function palette(S) {
  const col = S.col;
  for (let c = 0; c < 4; c++) {
    const h = S.hue + 0.12 + 0.25 * c, hh = h - floor(h);
    // Orange and yellow go brown in shade: paler, and lit higher.
    S.warm[c] = cl(1.6 - abs(hh - 0.11) / 0.08, 0, 1);
    hsv(h, 0.8 - 0.25 * S.warm[c], 1, col, 3 * c);
  }
  S.colHue = S.hue;
}

// Corners of face f of a tetrahedron, 0 and 1 the ends of its first hinge,
// 2 and 3 of its second, and the corner left out: two faces hold each hinge.
const FACES = [[0, 1, 2, 3], [0, 1, 3, 2], [2, 3, 0, 1], [2, 3, 1, 0]];
// The face sets. Along the ring the pieces come in fours: every second one
// is turned end for end and every odd one turned over, so the faces of a
// set are the ones that face the same way at the same time, front, back,
// inside or outside. Numbered in the order they come round to the front.
const CLASS = [[1, 3, 2, 0], [0, 2, 1, 3], [3, 1, 0, 2], [2, 0, 3, 1]];

// Rasterise one view into rows y0..y1 of the panel: back faces culled, the
// nearest face kept at each LED, lit flat.
function render(S, n, cy, y0, y1) {
  const v = S.sv, P = S.P, { id, cs, zb, sh, warm } = S, cam = CAM * S.radius, k = S.scale;
  for (let q = 0; q < n * 4; q++) {
    const pf = cam / (cam + v[3 * q + 2]);
    P[3 * q] = W / 2 + v[3 * q] * pf * k;
    P[3 * q + 1] = cy + v[3 * q + 1] * pf * k;
    P[3 * q + 2] = v[3 * q + 2];
  }
  for (let t = 0; t < n; t++)
    for (let f = 0; f < 4; f++) {
      const F = FACES[f], o = t * 4;
      let ia = o + F[0], ib = o + F[1];
      const ic = o + F[2], other = o + F[3];
      // Outward normal; a face turned away from the camera is skipped.
      const ax = v[3 * ia], ay = v[3 * ia + 1], az = v[3 * ia + 2];
      let n0 = (v[3 * ib + 1] - ay) * (v[3 * ic + 2] - az) - (v[3 * ib + 2] - az) * (v[3 * ic + 1] - ay);
      let n1 = (v[3 * ib + 2] - az) * (v[3 * ic] - ax) - (v[3 * ib] - ax) * (v[3 * ic + 2] - az);
      let n2 = (v[3 * ib] - ax) * (v[3 * ic + 1] - ay) - (v[3 * ib + 1] - ay) * (v[3 * ic] - ax);
      if (n0 * (v[3 * other] - ax) + n1 * (v[3 * other + 1] - ay) + n2 * (v[3 * other + 2] - az) > 0) (n0 = -n0), (n1 = -n1), (n2 = -n2), ([ia, ib] = [ib, ia]);
      if (n0 * ax + n1 * ay + n2 * (az + cam) >= 0) continue;
      const nl = sqrt(n0 * n0 + n1 * n1 + n2 * n2), cls = CLASS[t & 3][f];
      const lit0 = 0.26 + 0.74 * max(0, (n0 * LX + n1 * LY + n2 * LZ) / nl);
      const lit = lit0 + (1 - lit0) * 0.6 * warm[cls];
      const x0 = P[3 * ia], yy0 = P[3 * ia + 1], x1 = P[3 * ib], yy1 = P[3 * ib + 1], x2 = P[3 * ic], yy2 = P[3 * ic + 1];
      const area = (x1 - x0) * (yy2 - yy0) - (yy1 - yy0) * (x2 - x0);
      if (abs(area) < 1e-9) continue;
      const za = P[3 * ia + 2], zbb = P[3 * ib + 2], zc = P[3 * ic + 2];
      const xa = max(0, floor(min(x0, x1, x2))), xb = min(W - 1, floor(max(x0, x1, x2)));
      const ya = max(y0, floor(min(yy0, yy1, yy2))), yb = min(y1, floor(max(yy0, yy1, yy2)));
      const tag = 1 + t * 4 + f;
      for (let y = ya; y <= yb; y++) {
        const Y = y + 0.5;
        for (let x = xa; x <= xb; x++) {
          const X = x + 0.5;
          const w0 = ((x1 - X) * (yy2 - Y) - (yy1 - Y) * (x2 - X)) / area;
          const w1 = ((x2 - X) * (yy0 - Y) - (yy2 - Y) * (x0 - X)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
          const zz = w0 * za + w1 * zbb + w2 * zc, q = y * W + x;
          if (zz < zb[q]) (zb[q] = zz), (id[q] = tag), (cs[q] = cls), (sh[q] = lit);
        }
      }
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.colHue !== S.hue) palette(S);
  const n = S.n, col = S.col, { id, cs, zb, sh } = S;
  place(S, n, S.phase, S.v);
  id.fill(0);
  zb.fill(1e9);
  for (const [cy, side] of VIEWS) {
    view(S.v, n * 4, side, offAxis(S.tilt), S.sv);
    render(S, n, cy, cy - 32, cy + 31);
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o++) {
      const g = id[o];
      if (!g) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      // A one-LED dark seam where two faces meet, on the far one's side.
      let edge = false;
      for (const q of [x > 0 ? o - 1 : -1, x < W - 1 ? o + 1 : -1, y > 0 ? o - W : -1, y < H - 1 ? o + W : -1]) {
        if (q < 0 || id[q] === 0 || id[q] === g) continue;
        if (zb[q] < zb[o] - 1e-3 || (abs(zb[q] - zb[o]) <= 1e-3 && id[q] < g)) edge = true;
      }
      const c = cs[o] * 3, b = sh[o] * (edge ? 0.45 : 1);
      display.setPixel(x, y, round(255 * col[c] * b), round(255 * col[c + 1] * b), round(255 * col[c + 2] * b));
    }
}
