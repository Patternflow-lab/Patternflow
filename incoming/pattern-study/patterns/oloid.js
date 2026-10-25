// ===== Patternflow pattern =====
// Title:   Oloid
// Family:  space
// Idea:    An oloid, the hull of two circles each through the other's centre, rolls toward you down a dark floor in its swaying wobble, touching the floor along one straight ruling at a time, and leaves behind it the print of its own surface unrolled flat: the half round each circle in its own colour, the two locked together in a serpentine track that recedes up the panel.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the oloid (Paul Schatz, 1929), rolled on its development as Hans Dirnböck and Hellmuth Stachel unrolled it (1997), pattern round 47
// Round:   47
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Tilt=0..1, Fade=0..1
//
// Knob 1: Hue. Turns both halves round the wheel together, 0.38 of a turn apart: at 0 the half round one circle is azure and the half round the other pink; at 0.15 violet and orange; at 0.45 red and green; at 0.6 yellow and cyan; at 0.8 green and violet. Orange and yellow are printed brighter so they never dim to brown.
// Knob 2: Speed. At 2 the oloid rolls its whole surface over the floor once in 5 seconds, coming 4.8 circle radii toward you and swaying 0.28 radii either way twice on the way. At 0.2 it rolls ten times slower, at 3 half as fast again.
// Knob 3: Tilt. The camera's angle over the floor: at 0 it looks down at 53 degrees from in front, and the top of the panel is the floor five rolls back, where the track has narrowed to a third of its width; at 1 it looks straight down, the oloid tumbles at the foot of the panel and the track is a flat band of two serpents locked together.
// Knob 4: Fade. How long the print stays on the floor: at 0.06 it loses only a third of its brightness over five rolls and so runs up to the top of the panel, dimmed a little more by distance; at 0.5 it is down to a third two rolls back; at 1 it fades within half a roll, a short tongue of print behind the oloid.

const W = 64, H = 128, N = W * H;
const { floor, ceil, min, max, abs, sqrt, sin, cos, acos, exp, hypot, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p, i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p, i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p];
}
// How near a hue is to orange and yellow, 0 to 1.
const warm = (h) => max(0, 1 - abs(h - floor(h) - 0.11) / 0.13);
const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const crs = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
const nrm = (p) => {
  const l = hypot(p[0], p[1], p[2]) || 1;
  return [p[0] / l, p[1] / l, p[2] / l];
};

// The two circles, radius 1. A lies in the xy-plane round the origin and B
// in the xz-plane round (1, 0, 0), so each passes through the other's
// centre. Both angles count from the point farthest from the other circle.
const cA = (a) => [-cos(a), sin(a), 0];
const cB = (b) => [1 + cos(b), 0, sin(b)];
// A(a) and B(b) span a ruling of the hull when the tangent plane at A(a)
// also touches B at B(b). With d = B - A and the two tangents, that is
// det(tA, tB, d) = 0, which works out to cos a + cos b + cos a cos b = 0:
// for |b| up to 2 pi / 3 it gives one |a| up to 2 pi / 3, and the four
// signs are the four quarters of the surface. Every ruling is sqrt 3 long.
const partner = (u) => acos(cl(-cos(u) / (1 + cos(u)), -1, 1));
// The closed loop of rulings, s from 0 to 8. Each eighth steps the angle
// that moves fastest there, so the fans round the ends of the arcs, where
// one end of the ruling barely moves, are spaced as finely as the rest.
function ruling(s) {
  const sg = s >= 4 ? -1 : 1;
  if (s >= 4) s -= 4;
  let a, b;
  if (s < 1) (a = (PI / 2) * s), (b = partner(a));
  else if (s < 2) (b = (PI / 2) * (2 - s)), (a = partner(b));
  else if (s < 3) (b = (-PI / 2) * (s - 2)), (a = partner(b));
  else (a = (PI / 2) * (4 - s)), (b = -partner(a));
  return [sg * a, sg * b];
}

// Rulings per eighth of the loop for the roll, and every RS-th of them is
// an edge of the mesh drawn.
const M = 24, R = 8 * M, RS = 2, RM = R / RS;
// The centroid, by the symmetry that swaps the circles.
const CEN = [0.5, 0, 0];
// The camera: distance from the oloid, focal length in LEDs, and the row the
// oloid sits on, low so the track has room above it.
const CAMD = 7.4, FOC = 118, CY0 = 98;
// The light, a unit vector toward it: above, to the left, from the camera's side.
const LIGHT = nrm([-0.5, -0.55, 0.75]);
// The print on the floor is kept on a grid of CS radii over one roll.
const CS = 0.04, GX0 = -0.3, GNX = 96;
// One roll of the whole surface, in seconds at Speed 2.
const ROLL = 5;

export function setup(params) {
  // The rulings, their outward normals, and the development: unroll the
  // strip between neighbouring rulings into the plane, two triangles at a
  // time with every edge length kept, each new point on the side of the old
  // edge it lies on in space (the normal points down into the floor, so the
  // turn flips).
  const rA = [], rB = [], rn = [], a2 = [], b2 = [];
  for (let i = 0; i <= R; i++) {
    const [a, b] = ruling((i / M) % 8), A = cA(a), B = cB(b), d = sub(B, A);
    // The tangents can be parallel (at a = b = pi / 2), so the normal comes
    // from the ruling and whichever tangent is further from it.
    const c1 = crs(d, [sin(a), cos(a), 0]), c2 = crs(d, [-sin(b), 0, cos(b)]);
    let n = nrm(dot(c1, c1) > dot(c2, c2) ? c1 : c2);
    if (dot(n, sub([(A[0] + B[0]) / 2, A[1] / 2, B[2] / 2], CEN)) < 0) n = [-n[0], -n[1], -n[2]];
    rA.push(A), rB.push(B), rn.push(n);
  }
  const place = (o, d1, p, d2, sg) => {
    const dx = p[0] - o[0], dy = p[1] - o[1], D = hypot(dx, dy), x = (d1 * d1 - d2 * d2 + D * D) / (2 * D), h = sqrt(max(0, d1 * d1 - x * x));
    return [o[0] + (x * dx + sg * h * dy) / D, o[1] + (x * dy - sg * h * dx) / D];
  };
  const turn = (o, p, q, n) => (dot(crs(sub(p, o), sub(q, o)), n) < 0 ? -1 : 1);
  const len = (p, q) => hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  a2.push([0, 0]), b2.push([sqrt(3), 0]);
  for (let i = 0; i < R; i++) {
    const n = rn[i].map((v, k) => v + rn[i + 1][k]);
    const b = place(a2[i], len(rB[i + 1], rA[i]), b2[i], len(rB[i + 1], rB[i]), turn(rA[i], rB[i], rB[i + 1], n));
    b2.push(b);
    a2.push(place(a2[i], len(rA[i + 1], rA[i]), b, len(rA[i + 1], rB[i + 1]), turn(rA[i], rB[i + 1], rA[i + 1], n)));
  }
  // One roll moves the print on by T: 4.836 radii straight down -y, with no
  // turn (checked: under 1e-7 degrees), so the oloid rolls in a straight line.
  const T = [a2[R][0] - a2[0][0], a2[R][1] - a2[0][1]];
  // The pose with ruling i on the floor: the ruling laid on its developed
  // place, the tangent plane along it on the floor, as a rotation (a
  // quaternion) and where the centroid lands.
  const q = new Float64Array((R + 1) * 4), cw = new Float64Array((R + 1) * 3), cum = new Float64Array(R + 1);
  for (let i = 0; i <= R; i++) {
    const e1 = nrm(sub(rB[i], rA[i])), e3 = rn[i], e2 = crs(e3, e1);
    const f = nrm([b2[i][0] - a2[i][0], b2[i][1] - a2[i][1], 0]), g1 = f, g2 = [f[1], -f[0], 0], g3 = [0, 0, -1];
    const m = [0, 1, 2].map((r) => [0, 1, 2].map((c) => g1[r] * e1[c] + g2[r] * e2[c] + g3[r] * e3[c]));
    const o = i * 4, tr = m[0][0] + m[1][1] + m[2][2];
    if (tr > 0) {
      const s = 2 * sqrt(tr + 1);
      (q[o] = s / 4), (q[o + 1] = (m[2][1] - m[1][2]) / s), (q[o + 2] = (m[0][2] - m[2][0]) / s), (q[o + 3] = (m[1][0] - m[0][1]) / s);
    } else {
      const k = m[0][0] > m[1][1] && m[0][0] > m[2][2] ? 0 : m[1][1] > m[2][2] ? 1 : 2, k1 = (k + 1) % 3, k2 = (k + 2) % 3;
      const s = 2 * sqrt(1 + m[k][k] - m[k1][k1] - m[k2][k2]);
      q[o] = (m[k2][k1] - m[k1][k2]) / s;
      q[o + 1 + k] = s / 4;
      q[o + 1 + k1] = (m[k1][k] + m[k][k1]) / s;
      q[o + 1 + k2] = (m[k2][k] + m[k][k2]) / s;
    }
    if (i > 0 && q[o] * q[o - 4] + q[o + 1] * q[o - 3] + q[o + 2] * q[o - 2] + q[o + 3] * q[o - 1] < 0) for (let j = 0; j < 4; j++) q[o + j] = -q[o + j];
    const c = sub(CEN, rA[i]);
    for (let r = 0; r < 3; r++) cw[i * 3 + r] = m[r][0] * c[0] + m[r][1] * c[1] + m[r][2] * c[2] + (r < 2 ? a2[i][r] : 0);
    // The roll is timed by the centroid's path: it moves at an even speed.
    if (i > 0) cum[i] = cum[i - 1] + hypot(cw[i * 3] - cw[i * 3 - 3], cw[i * 3 + 1] - cw[i * 3 - 2], cw[i * 3 + 2] - cw[i * 3 - 1]);
  }
  let xmid = 0;
  for (let i = 0; i < R; i++) xmid += cw[i * 3] / R;
  // The mesh: each drawn ruling as A, its midpoint and B, so each strip is
  // a quad on the A half and a quad on the B half; the normal is the same
  // all along a ruling, as on any developable surface.
  const mesh = new Float64Array((RM + 1) * 9), mn = new Float64Array(RM * 3);
  for (let j = 0; j <= RM; j++) {
    const A = rA[j * RS], B = rB[j * RS];
    for (let k = 0; k < 3; k++) (mesh[j * 9 + k] = A[k]), (mesh[j * 9 + 3 + k] = (A[k] + B[k]) / 2), (mesh[j * 9 + 6 + k] = B[k]);
    if (j < RM) {
      const n = nrm(rn[j * RS].map((v, k) => v + rn[j * RS + RS][k]));
      for (let k = 0; k < 3; k++) mn[j * 3 + k] = n[k];
    }
  }
  // The rims: the two arcs of 240 degrees that are edges of the hull.
  const ARC = 48, arcs = new Float64Array(2 * (ARC + 1) * 3);
  for (let c = 0; c < 2; c++)
    for (let j = 0; j <= ARC; j++) {
      const p = (c ? cB : cA)(((j / ARC) * 2 - 1) * ((2 * PI) / 3));
      for (let k = 0; k < 3; k++) arcs[(c * (ARC + 1) + j) * 3 + k] = p[k];
    }
  // The print of one roll on the floor grid: strip i's A half codes 2i,
  // its B half 2i + 1. A strip that pokes past either end of the roll is
  // filed at the other end, marked as from the roll before or after.
  const P = -T[1], GNY = ceil(P / CS), grid = new Int16Array(GNX * GNY).fill(-1), wrap = new Int8Array(GNX * GNY);
  const fill = (pts, code) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => -p[1]);
    const x0 = floor((min(...xs) - GX0) / CS), x1 = ceil((max(...xs) - GX0) / CS), y0 = floor(min(...ys) / CS), y1 = ceil(max(...ys) / CS);
    for (let gy = y0; gy <= y1; gy++)
      for (let gx = max(0, x0); gx <= min(GNX - 1, x1); gx++) {
        const px = GX0 + (gx + 0.5) * CS, py = -(gy + 0.5) * CS;
        let inside = true, sgn = 0;
        for (let k = 0; k < pts.length && inside; k++) {
          const p = pts[k], o = pts[(k + 1) % pts.length], c = (o[0] - p[0]) * (py - p[1]) - (o[1] - p[1]) * (px - p[0]);
          if (abs(c) < 1e-12) continue;
          if (sgn === 0) sgn = c > 0 ? 1 : -1;
          else if ((c > 0 ? 1 : -1) !== sgn) inside = false;
        }
        if (!inside) continue;
        const w = gy < 0 ? 1 : gy >= GNY ? -1 : 0, row = gy + w * GNY;
        grid[row * GNX + gx] = code;
        wrap[row * GNX + gx] = w;
      }
  };
  for (let i = 0; i < R; i++) {
    const m0 = [(a2[i][0] + b2[i][0]) / 2, (a2[i][1] + b2[i][1]) / 2], m1 = [(a2[i + 1][0] + b2[i + 1][0]) / 2, (a2[i + 1][1] + b2[i + 1][1]) / 2];
    fill([a2[i], m0, m1, a2[i + 1]], 2 * i);
    fill([m0, b2[i], b2[i + 1], m1], 2 * i + 1);
  }
  params.s = {
    hue: 0, speed: 2, tilt: 0, fade: 0.06, dist: 0, U: 0,
    q, cw, cum, T, P, GNY, grid, wrap, xmid, mesh, mn, arcs, ARC,
    rot: new Float64Array(9), pos: new Float64Array(3), cam: new Float64Array(12),
    vw: new Float64Array((RM + 1) * 9), vs: new Float64Array((RM + 1) * 9), aw: new Float64Array(arcs.length),
    zb: new Float32Array(N), rgb: new Float32Array(N * 3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.tilt = cl(k[2], 0, 1);
  S.fade = cl(k[3], 0, 1);
  const Lc = S.cum[R];
  S.dist += ((d * S.speed) / 2) * (Lc / ROLL);
  // Where the roll is: ruling i and the fraction f on to the next, found by
  // the centroid's path length within this roll.
  const kc = floor(S.dist / Lc), u = S.dist - kc * Lc, cum = S.cum;
  let lo = 0, hi = R;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= u) lo = m;
    else hi = m;
  }
  const f = cl((u - cum[lo]) / (cum[lo + 1] - cum[lo] || 1), 0, 1);
  S.U = kc * R + lo + f;
  // The pose between rulings lo and lo + 1: the rotations blended and
  // renormalised, the centroid moved along, and kc rolls added on.
  const q = S.q, o = lo * 4;
  let w = mix(q[o], q[o + 4], f), x = mix(q[o + 1], q[o + 5], f), y = mix(q[o + 2], q[o + 6], f), z = mix(q[o + 3], q[o + 7], f);
  const l = hypot(w, x, y, z);
  (w /= l), (x /= l), (y /= l), (z /= l);
  const m = S.rot;
  m[0] = 1 - 2 * (y * y + z * z), m[1] = 2 * (x * y - w * z), m[2] = 2 * (x * z + w * y);
  m[3] = 2 * (x * y + w * z), m[4] = 1 - 2 * (x * x + z * z), m[5] = 2 * (y * z - w * x);
  m[6] = 2 * (x * z - w * y), m[7] = 2 * (y * z + w * x), m[8] = 1 - 2 * (x * x + y * y);
  const cw = S.cw;
  for (let r = 0; r < 3; r++) {
    const c = mix(cw[lo * 3 + r], cw[lo * 3 + 3 + r], f) + (r < 2 ? kc * S.T[r] : 0);
    S.pos[r] = c - (m[r * 3] * CEN[0] + m[r * 3 + 1] * CEN[1] + m[r * 3 + 2] * CEN[2]);
  }
  // The camera follows the centroid down the track and keeps to the middle
  // of its sway, so the sway shows; it sits in front, looking back up the
  // track, from 53 degrees over the floor at Tilt 0 to straight down at 1.
  const pitch = mix(0.92, PI / 2 - 1e-4, S.tilt), cy = mix(cw[lo * 3 + 1], cw[lo * 3 + 4], f) + kc * S.T[1];
  const C = S.cam;
  C[0] = S.xmid;
  C[1] = cy - CAMD * cos(pitch);
  C[2] = 0.6 + CAMD * sin(pitch);
  // Forward, right and up.
  (C[3] = 0), (C[4] = cos(pitch)), (C[5] = -sin(pitch));
  (C[6] = 1), (C[7] = 0), (C[8] = 0);
  (C[9] = 0), (C[10] = sin(pitch)), (C[11] = cos(pitch));
}

// Fill a screen triangle into the depth buffer, nearest wins: iz is 1 over
// the depth, interpolated across the screen as it is linear there.
function tri(S, ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (abs(area) < 1e-6) return;
  const x0 = max(0, floor(min(ax, bx, cx))), x1 = min(W - 1, ceil(max(ax, bx, cx)));
  const y0 = max(0, floor(min(ay, by, cy))), y1 = min(H - 1, ceil(max(ay, by, cy)));
  const zb = S.zb, rgb = S.rgb;
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const w0 = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area, w1 = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const iz = w0 * az + w1 * bz + w2 * cz, i = y * W + x;
      if (iz <= zb[i]) continue;
      zb[i] = iz;
      (rgb[i * 3] = r), (rgb[i * 3 + 1] = g), (rgb[i * 3 + 2] = b);
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { rot: m, pos, cam: C, zb, rgb, grid, wrap, GNY, P } = S;
  // The two halves' colours. Orange and yellow dimmed read brown and olive,
  // so a half that comes round to them is printed brighter and shaded less deep.
  const hA = 0.56 + S.hue, hB = 0.94 + S.hue, wA = warm(hA), wB = warm(hB);
  const colA = hsv(hA, 0.78, 1), colB = hsv(hB, 0.72, 1);
  const pvA = 0.62 + 0.3 * wA, pvB = 0.62 + 0.3 * wB, loA = 0.3 + 0.25 * wA, loB = 0.3 + 0.25 * wB;
  // World to screen: [x, y, 1 / depth].
  const proj = (wx, wy, wz, out, o) => {
    const vx = wx - C[0], vy = wy - C[1], vz = wz - C[2], zc = vx * C[3] + vy * C[4] + vz * C[5];
    out[o] = 32 + (FOC * (vx * C[6] + vy * C[7] + vz * C[8])) / zc;
    out[o + 1] = CY0 - (FOC * (vx * C[9] + vy * C[10] + vz * C[11])) / zc;
    out[o + 2] = 1 / zc;
  };
  const toWorld = (src, so, out, o) => {
    const x = src[so], y = src[so + 1], z = src[so + 2];
    out[o] = m[0] * x + m[1] * y + m[2] * z + pos[0];
    out[o + 1] = m[3] * x + m[4] * y + m[5] * z + pos[1];
    out[o + 2] = m[6] * x + m[7] * y + m[8] * z + pos[2];
  };
  // The floor, ray by ray: where each LED's ray meets it, and what of the
  // print lies there. A strip of roll kc was printed when the roll passed
  // it, so its age is how many rulings ago that was.
  const fade = R * 0.25 * 60 ** (1 - S.fade);
  for (let py = 0; py < H; py++) {
    const vy = (CY0 - py - 0.5) / FOC;
    for (let px = 0; px < W; px++) {
      const i = py * W + px, vx = (px + 0.5 - 32) / FOC;
      zb[i] = 0;
      const dx = C[3] + vx * C[6] + vy * C[9], dy = C[4] + vx * C[7] + vy * C[10], dz = C[5] + vx * C[8] + vy * C[11];
      let r = 0.025, g = 0.012, b = 0.06;
      if (dz < 0) {
        const t = -C[2] / dz, fx = C[0] + t * dx, fy = C[1] + t * dy;
        const yy = -fy, kc = floor(yy / P), gy = floor((yy - kc * P) / CS), gx = floor((fx - GX0) / CS);
        if (gx >= 0 && gx < GNX && gy >= 0 && gy < GNY) {
          const c = grid[gy * GNX + gx];
          if (c >= 0) {
            const age = S.U - ((kc + wrap[gy * GNX + gx]) * R + (c >> 1) + 0.5);
            if (age > 0) {
              const v = (c & 1 ? pvB : pvA) * exp(-age / fade) * cl(1.25 - t / 40, 0.25, 1), col = c & 1 ? colB : colA;
              (r += col[0] * v), (g += col[1] * v), (b += col[2] * v);
            }
          }
        }
      }
      (rgb[i * 3] = r), (rgb[i * 3 + 1] = g), (rgb[i * 3 + 2] = b);
    }
  }
  // The body: every mesh point to the world and the screen, then each quad
  // facing the camera as two triangles, shaded by its ruling's normal.
  const { mesh, mn, vw, vs } = S;
  for (let j = 0; j < (RM + 1) * 3; j++) {
    toWorld(mesh, j * 3, vw, j * 3);
    proj(vw[j * 3], vw[j * 3 + 1], vw[j * 3 + 2], vs, j * 3);
  }
  for (let j = 0; j < RM; j++) {
    const nx = m[0] * mn[j * 3] + m[1] * mn[j * 3 + 1] + m[2] * mn[j * 3 + 2];
    const ny = m[3] * mn[j * 3] + m[4] * mn[j * 3 + 1] + m[5] * mn[j * 3 + 2];
    const nz = m[6] * mn[j * 3] + m[7] * mn[j * 3 + 1] + m[8] * mn[j * 3 + 2];
    const o = j * 9 + 3;
    if (nx * (vw[o] - C[0]) + ny * (vw[o + 1] - C[1]) + nz * (vw[o + 2] - C[2]) > 0.02) continue;
    const lit = max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    for (let h = 0; h < 2; h++) {
      const col = h ? colB : colA, lo = h ? loB : loA, sh = lo + (1 - lo) * lit, p = j * 9 + h * 3, q = p + 9;
      tri(S, vs[p], vs[p + 1], vs[p + 2], vs[p + 3], vs[p + 4], vs[p + 5], vs[q + 3], vs[q + 4], vs[q + 5], col[0] * sh, col[1] * sh, col[2] * sh);
      tri(S, vs[p], vs[p + 1], vs[p + 2], vs[q + 3], vs[q + 4], vs[q + 5], vs[q], vs[q + 1], vs[q + 2], col[0] * sh, col[1] * sh, col[2] * sh);
    }
  }
  // The rims, the two circles' arcs, drawn where nothing nearer hides them.
  const { arcs, aw, ARC } = S;
  for (let j = 0; j < arcs.length / 3; j++) toWorld(arcs, j * 3, aw, j * 3);
  const a = [0, 0, 0], bq = [0, 0, 0];
  for (let c = 0; c < 2; c++) {
    const col = c ? colB : colA;
    for (let j = 0; j < ARC; j++) {
      const o = (c * (ARC + 1) + j) * 3;
      proj(aw[o], aw[o + 1], aw[o + 2], a, 0);
      proj(aw[o + 3], aw[o + 4], aw[o + 5], bq, 0);
      const steps = ceil(max(abs(bq[0] - a[0]), abs(bq[1] - a[1])) * 2) + 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, x = floor(mix(a[0], bq[0], t)), y = floor(mix(a[1], bq[1], t));
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x, iz = mix(a[2], bq[2], t);
        if (iz < zb[i] * 0.985) continue;
        (rgb[i * 3] = 0.55 + 0.45 * col[0]), (rgb[i * 3 + 1] = 0.55 + 0.45 * col[1]), (rgb[i * 3 + 2] = 0.55 + 0.45 * col[2]);
      }
    }
  }
  for (let i = 0; i < N; i++)
    display.setPixel(i % W, floor(i / W), (255 * cl(rgb[i * 3], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 1], 0, 1)) | 0, (255 * cl(rgb[i * 3 + 2], 0, 1)) | 0);
}
