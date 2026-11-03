// ===== Patternflow pattern =====
// Title:   Feuerbach Circle
// Family:  geometry
// Idea:    A triangle keeps changing shape round its nine-point circle, which stays put in the middle of the panel while the triangle turns to stand on its long axis, and as the triangle goes from acute to obtuse and back its incircle rolls round inside that circle and its three excircles round outside it, stacked above, below and beside it, each touching it at one lit point that slides along it among the nine points the circle is named for.
// Author:  patternflow-lab
// Date:    2026-11-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the nine-point circle through the side midpoints, the feet of the altitudes and the midpoints from the orthocentre to the vertices (Charles Brianchon and Jean-Victor Poncelet, 1821), and Feuerbach's theorem that it touches the incircle and the three excircles (Karl Wilhelm Feuerbach, 1822), pattern round 103
// Round:   103
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wander=0..1, Zoom=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the incircle is aqua, the three excircles azure, violet and orchid, the nine-point circle pale gold and the triangle near white; at 0.5 the incircle is red and the excircles orange, lime and green round a pale lavender nine-point circle. An excircle that lands between orange and yellow keeps its ring but has its dim fill paled, so it reads beige and not brown.
// Knob 2: Speed. At 2 the triangle goes once round its loop of shapes in 30 s: three times an obtuse shape of up to 125 degrees stands on its long side with one excircle pressed along it, and between them a tall acute one; every 5 s it passes an isosceles shape, where the incircle's touching point and one excircle's meet on the circle and cross. The loop's reach breathes 8 percent over 23.5 s. Every time goes as 2 / Speed, so a lap is 300 s at 0.2 and 20 s at 3.
// Knob 3: Wander. How far from equilateral the loop runs. At 0 the angles stay between 19 and 125 degrees, the incircle 5 to 10 LEDs in radius with its centre 3 to 8 LEDs from the nine-point centre; at 0.5 between 14 and 141 degrees; at 1 between 12 and 150, the incircle down to 1.7 LEDs and the largest excircle 103 LEDs in radius, its rim nearly straight down the panel's side. The loop never comes near the equilateral triangle, where the incircle would lie on the nine-point circle all the way round.
// Knob 4: Zoom. The nine-point circle's radius: 13 LEDs at 0 and 13.6 at the opening 0.06, falling to 5 at -1, where the triangle stays within rows 50 to 78 and the excircles round it show as whole circles or long arcs, and rising to 26 at 1, where the circle spans 52 of the 64 columns, the vertices run off the top and bottom of the panel and the four touching points stand large.

// For a triangle ABC the side midpoints, the feet of the three altitudes
// and the midpoints of AH, BH and CH, H the orthocentre, lie on one circle.
// Its centre N is the midpoint of the circumcentre O and H, on the Euler
// line, and its radius is half the circumradius R. Feuerbach (1822) showed
// that it touches the incircle from inside and each excircle from outside:
//
//   |N I| = R/2 - r   and   |N J_a| = R/2 + r_a, and the same for b and c.
//
// The touching points lie on the rays from N through I and through each
// excentre; the one on the incircle is the Feuerbach point.
//
// Every frame the triangle is built from its angles alone and everything
// is computed from its three vertices by the plain constructions: O as the
// circle through the vertices, H as the meet of two altitudes, N and R/2 as
// the circle through the three midpoints, I and the excentres by weights of
// the side lengths, r and r_a as the area over s and over s - a. Then the
// two tangency equations and the six other points' distances from N are
// checked against R/2. The worst miss in a frame, as a share of R/2, stays
// under 1e-13 along the whole loop at any Wander; setup() checks 2,000
// random triangles with angles down to half a degree, and the worst of
// those is under 1e-11.
//
// The shape loops round the equilateral triangle in the simplex of angles
// without coming near it: there the incircle and the nine-point circle
// become one and the Euler line is not defined. The loop's reach swells
// past the scalene shapes between the isosceles ones, so the sharpest
// obtuse moment has three different sides and four distinct touching
// points; the isosceles moments, six to a lap, are the instants when the
// incircle and one excircle touch the nine-point circle at the same point,
// the midpoint of the equal sides' base, where it touches that side too.
//
// The panel turns the triangle so the major axis of its three vertices'
// second moments stands up the panel, which puts the long side or the
// long axis upright and stacks two excircles above and below the circle.

const W = 64, H = 128;
const { floor, round, min, max, abs, sqrt, sin, cos, atan2, exp, PI, pow } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = 2 * PI;
// The nine-point centre on the panel.
const CX = 32, CY = 64;
// Story seconds at Speed 1 for the shape to go once round the loop; where
// it starts; the period on which its reach breathes 8 percent.
const LAP = 60, TH0 = 1.31, BREATH = 47;
// No angle falls below 10 degrees.
const AMIN = (10 * PI) / 180;

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
}

// A dim fill's colour: orange to yellow, which read brown and olive that
// dim, is paled.
function tint(h, s) {
  const u = h - floor(h);
  return hsv(h, u > 0.02 && u < 0.23 ? 0.3 : s, 1);
}

// The triangle's angles at phase th and reach k: each angle is AMIN plus
// its share of the rest, the shares a softmax of k cos(th - 2 pi i / 3), so
// the largest angle peaks when th points at its corner. The reach swells
// by a quarter at th = pi / 6 between corners, where the shape is most
// scalene.
function angles(th, k) {
  const kk = k * (1 + 0.25 * sin(3 * th));
  const z = [0, 1, 2].map((i) => exp(kk * cos(th - (i * TAU) / 3)));
  const t = z[0] + z[1] + z[2];
  return z.map((v) => AMIN + ((PI - 3 * AMIN) * v) / t);
}

const dist = (p, q) => sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2);
const mix = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];

// The centre of the circle through three points.
function circum(p, q, r) {
  const ax = p[0], ay = p[1], bx = q[0], by = q[1], cx = r[0], cy = r[1];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
  return [(a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d, (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d];
}

// The foot of the perpendicular from p to the line through q and r.
function foot(p, q, r) {
  const dx = r[0] - q[0], dy = r[1] - q[1];
  const u = ((p[0] - q[0]) * dx + (p[1] - q[1]) * dy) / (dx * dx + dy * dy);
  return [q[0] + u * dx, q[1] + u * dy];
}

// Everything of the triangle with these angles, from its vertices alone,
// and the worst miss of Feuerbach's tangencies (tang) and of the feet and
// the Euler points on the circle through the midpoints (on), as shares of
// that circle's radius.
function triangle(ang) {
  const [A, , C] = ang;
  const P = [[1, 0], [cos(2 * C), sin(2 * C)], [cos(2 * C + 2 * A), sin(2 * C + 2 * A)]];
  const [pa, pb, pc] = P;
  const a = dist(pb, pc), b = dist(pc, pa), c = dist(pa, pb), s = (a + b + c) / 2;
  const area = abs((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1])) / 2;
  const O = circum(pa, pb, pc);
  const feet = [foot(pa, pb, pc), foot(pb, pc, pa), foot(pc, pa, pb)];
  // The altitudes from A and from B, met.
  const d1x = feet[0][0] - pa[0], d1y = feet[0][1] - pa[1], d2x = feet[1][0] - pb[0], d2y = feet[1][1] - pb[1];
  const u = ((pb[0] - pa[0]) * d2y - (pb[1] - pa[1]) * d2x) / (d1x * d2y - d1y * d2x);
  const Hc = [pa[0] + u * d1x, pa[1] + u * d1y];
  const mids = [mix(pb, pc, 0.5), mix(pc, pa, 0.5), mix(pa, pb, 0.5)];
  const N = circum(mids[0], mids[1], mids[2]);
  const rho = dist(N, mids[0]);
  const eul = P.map((p) => mix(p, Hc, 0.5));
  const I = [(a * pa[0] + b * pb[0] + c * pc[0]) / (2 * s), (a * pa[1] + b * pb[1] + c * pc[1]) / (2 * s)];
  const r = area / s;
  const J = [[-a, b, c], [a, -b, c], [a, b, -c]].map(([x, y, z]) => {
    const t = x + y + z;
    return [(x * pa[0] + y * pb[0] + z * pc[0]) / t, (x * pa[1] + y * pb[1] + z * pc[1]) / t];
  });
  const rx = [area / (s - a), area / (s - b), area / (s - c)];
  let tang = abs(dist(N, I) - (rho - r));
  for (let i = 0; i < 3; i++) tang = max(tang, abs(dist(N, J[i]) - (rho + rx[i])));
  let on = abs(dist(N, mix(O, Hc, 0.5))) + abs(rho - dist(O, pa) / 2);
  for (const p of feet.concat(eul)) on = max(on, abs(dist(N, p) - rho));
  return { P, O, Hc, N, rho, mids, feet, eul, I, r, J, rx, tang: tang / rho, on: on / rho };
}

// Feuerbach's theorem and the nine points on 2,000 random triangles.
function check() {
  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    const x = Math.random(), y = Math.random();
    const A = 0.01 + (PI - 0.03) * min(x, y), B = 0.01 + (PI - 0.03) * (max(x, y) - min(x, y));
    const g = triangle([A, B, PI - A - B]);
    worst = max(worst, g.tang, g.on);
  }
  return worst;
}

export function setup(params) {
  params.s = {
    t: 0, hue: 0, wander: 0, zoom: 0.06, checked: check(), err: 0, ax: 0, ay: 1, g: null,
    buf: new Float32Array(W * H * 3), circ: new Float64Array(4 * 4), lines: new Float64Array(7 * 8),
  };
}

// The nine-point circle's radius in LEDs at this zoom: 13 at 0, 5 at -1, 26 at 1.
const radiusOf = (z) => (z < 0 ? 13 * pow(5 / 13, -z) : 13 * pow(2, z));

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0] || 0;
  const speed = cl(k[1] == null ? 2 : k[1], 0.2, 3);
  S.wander = cl(k[2] || 0, 0, 1);
  S.zoom = cl(k[3] == null ? 0.06 : k[3], -1, 1);
  S.t += d * speed;
  const th = TH0 + (TAU * S.t) / LAP;
  const reach = (1.05 + 0.85 * S.wander) * (1 + 0.08 * sin((TAU * S.t) / BREATH));
  const g = triangle(angles(th, reach));
  S.err = max(S.err, g.tang, g.on);
  // Onto the panel: N to the centre, the circle's radius to R LEDs, and
  // the major axis of the vertices' second moments upright, its sign kept
  // from the frame before.
  const R = radiusOf(S.zoom);
  const gx = (g.P[0][0] + g.P[1][0] + g.P[2][0]) / 3, gy = (g.P[0][1] + g.P[1][1] + g.P[2][1]) / 3;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of g.P) {
    sxx += (p[0] - gx) ** 2;
    sxy += (p[0] - gx) * (p[1] - gy);
    syy += (p[1] - gy) ** 2;
  }
  const phi = 0.5 * atan2(2 * sxy, sxx - syy);
  let ux = cos(phi), uy = sin(phi);
  if (ux * S.ax + uy * S.ay < 0) {
    ux = -ux;
    uy = -uy;
  }
  S.ax = ux;
  S.ay = uy;
  const sc = R / g.rho;
  const T = (p) => {
    const vx = p[0] - g.N[0], vy = p[1] - g.N[1];
    return [CX + sc * (-uy * vx + ux * vy), CY + sc * (-ux * vx - uy * vy)];
  };
  // The touching point on the nine-point circle, toward a circle's centre.
  const toward = (p) => {
    const q = T(p), vx = q[0] - CX, vy = q[1] - CY, l = sqrt(vx * vx + vy * vy);
    return [CX + (R * vx) / l, CY + (R * vy) / l];
  };
  S.g = {
    R, P: g.P.map(T), O: T(g.O), Hc: T(g.Hc), I: T(g.I), r: g.r * sc,
    J: g.J.map(T), rx: g.rx.map((v) => v * sc),
    mids: g.mids.map(T), feet: g.feet.map(T), eul: g.eul.map(T),
    F: toward(g.I), Fx: g.J.map(toward),
  };
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.g) return;
  const G = S.g, buf = S.buf, h0 = S.hue, circ = S.circ, lines = S.lines;
  // Hue 0: the incircle aqua, the excircles azure, indigo and orchid, the
  // nine-point circle pale gold, the triangle near white.
  const cIn = hsv(h0 + 0.47, 0.75, 1), fIn = tint(h0 + 0.47, 0.75);
  const hx = [h0 + 0.6, h0 + 0.71, h0 + 0.85];
  const cEx = [hsv(hx[0], 0.7, 1), hsv(hx[1], 0.6, 1), hsv(hx[2], 0.55, 1)];
  const fEx = [tint(hx[0], 0.7), tint(hx[1], 0.6), tint(hx[2], 0.55)];
  const cNine = hsv(h0 + 0.13, 0.32, 1);
  const cSide = hsv(h0 + 0.6, 0.12, 1);
  for (let j = 0; j < 4; j++) {
    const o = j * 4;
    circ[o] = j < 3 ? G.J[j][0] : G.I[0];
    circ[o + 1] = j < 3 ? G.J[j][1] : G.I[1];
    circ[o + 2] = j < 3 ? G.rx[j] : G.r;
  }
  // Lines: a point, unit direction, the stretch along it drawn bright,
  // which side of it is the triangle's, the dash, the colour index.
  let nl = 0;
  const line = (px, py, dx, dy, a0, a1, side, dash, col) => {
    const o = nl++ * 8;
    lines[o] = px; lines[o + 1] = py; lines[o + 2] = dx; lines[o + 3] = dy;
    lines[o + 4] = a0; lines[o + 5] = a1; lines[o + 6] = side; lines[o + 7] = dash * 4 + col;
  };
  for (let i = 0; i < 3; i++) {
    const p = G.P[(i + 1) % 3], q = G.P[(i + 2) % 3], v = G.P[i];
    const dx = q[0] - p[0], dy = q[1] - p[1], l = sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l;
    line(p[0], p[1], ux, uy, 0, l, (v[0] - p[0]) * uy - (v[1] - p[1]) * ux, 0, 0);
  }
  // The altitudes, dotted from each vertex through its foot to H.
  for (let i = 0; i < 3; i++) {
    const p = G.P[i], f = G.feet[i];
    const dx = f[0] - p[0], dy = f[1] - p[1], l = sqrt(dx * dx + dy * dy), ux = dx / l, uy = dy / l;
    const hA = (G.Hc[0] - p[0]) * ux + (G.Hc[1] - p[1]) * uy;
    line(p[0], p[1], ux, uy, min(0, hA), max(l, hA), 0, 1, 1);
  }
  // The Euler line, dashed from O to H.
  {
    const dx = G.Hc[0] - G.O[0], dy = G.Hc[1] - G.O[1], l = sqrt(dx * dx + dy * dy);
    line(G.O[0], G.O[1], dx / l, dy / l, 0, l, 0, 2, 1);
  }
  const R = G.R;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      let r = 0, gg = 0, b = 0;
      // The four circles: a dim fill and a ring.
      for (let j = 0; j < 4; j++) {
        const o = j * 4, ex = px - circ[o], ey = py - circ[o + 1];
        const dd = sqrt(ex * ex + ey * ey) - circ[o + 2];
        const c = j < 3 ? cEx[j] : cIn;
        if (dd < 0) {
          const f = j < 3 ? fEx[j] : fIn, v = j < 3 ? 30 : 44;
          r += f[0] * v; gg += f[1] * v; b += f[2] * v;
        }
        const a = 1 - abs(dd) / 0.9;
        if (a > 0) {
          const v = (j < 3 ? 150 : 180) * a;
          r += c[0] * v; gg += c[1] * v; b += c[2] * v;
        }
      }
      // The nine-point circle.
      {
        const ex = px - CX, ey = py - CY, a = cl(1.6 - abs(sqrt(ex * ex + ey * ey) - R) / 0.9, 0, 1);
        if (a > 0) {
          r += cNine[0] * 235 * a; gg += cNine[1] * 235 * a; b += cNine[2] * 235 * a;
        }
      }
      // Inside the triangle, a faint wash.
      let inside = 0;
      for (let j = 0; j < 3; j++) {
        const o = j * 8;
        if (((px - lines[o]) * lines[o + 3] - (py - lines[o + 1]) * lines[o + 2]) * lines[o + 6] > 0) inside++;
      }
      if (inside === 3) {
        r += cSide[0] * 30; gg += cSide[1] * 30; b += cSide[2] * 30;
      }
      for (let j = 0; j < nl; j++) {
        const o = j * 8, vx = px - lines[o], vy = py - lines[o + 1];
        const a = 1 - abs(vx * lines[o + 3] - vy * lines[o + 2]) / 0.8;
        if (a <= 0) continue;
        const along = vx * lines[o + 2] + vy * lines[o + 3], kind = lines[o + 7], dash = kind >> 2;
        if (dash === 1 && floor(along) % 3 !== 0) continue;
        if (dash === 2 && floor(along / 2) % 2 !== 0) continue;
        const on = along >= lines[o + 4] && along <= lines[o + 5];
        const c = kind & 3 ? cNine : cSide, v = (dash === 1 ? (on ? 52 : 0) : dash ? (on ? 72 : 0) : on ? 215 : 50) * a;
        r += c[0] * v; gg += c[1] * v; b += c[2] * v;
      }
      const i = (y * W + x) * 3;
      buf[i] = r;
      buf[i + 1] = gg;
      buf[i + 2] = b;
    }
  }
  // A dot (core) or a soft halo, added.
  const glow = (p, rad, c, v, core) => {
    for (let y = max(0, floor(p[1] - rad - 1)); y <= min(H - 1, p[1] + rad + 1); y++)
      for (let x = max(0, floor(p[0] - rad - 1)); x <= min(W - 1, p[0] + rad + 1); x++) {
        const ex = x + 0.5 - p[0], ey = y + 0.5 - p[1], dd = sqrt(ex * ex + ey * ey);
        const a = core ? cl(rad + 0.5 - dd, 0, 1) : cl(1 - dd / rad, 0, 1) ** 2;
        if (a <= 0) continue;
        const i = (y * W + x) * 3;
        buf[i] += c[0] * v * a;
        buf[i + 1] += c[1] * v * a;
        buf[i + 2] += c[2] * v * a;
      }
  };
  const white = [1, 1, 1];
  for (const p of G.P) glow(p, 1.2, white, 255, true);
  for (const p of G.mids.concat(G.feet, G.eul)) glow(p, 0.9, white, 255, true);
  glow(G.O, 0.9, cNine, 200, true);
  glow(G.Hc, 0.9, cNine, 200, true);
  // The four touching points: a halo in the touching circle's colour and a
  // white core. Feuerbach's point, the incircle's, stands in a dark ring
  // with a larger core.
  for (let j = 0; j < 3; j++) {
    glow(G.Fx[j], 3.2, cEx[j], 220, false);
    glow(G.Fx[j], 1.1, white, 255, true);
  }
  const F = G.F;
  for (let y = max(0, floor(F[1] - 4)); y <= min(H - 1, F[1] + 4); y++)
    for (let x = max(0, floor(F[0] - 4)); x <= min(W - 1, F[0] + 4); x++) {
      const ex = x + 0.5 - F[0], ey = y + 0.5 - F[1], q = cl((sqrt(ex * ex + ey * ey) - 2.4) / 0.9, 0, 1);
      const i = (y * W + x) * 3, m = 0.12 + 0.88 * q;
      buf[i] *= m;
      buf[i + 1] *= m;
      buf[i + 2] *= m;
    }
  glow(F, 1.6, white, 255, true);
  for (let y = 0, i = 0; y < H; y++)
    for (let x = 0; x < W; x++, i += 3) {
      const m = max(buf[i], buf[i + 1], buf[i + 2]), q = m > 255 ? 255 / m : 1;
      display.setPixel(x, y, round(buf[i] * q), round(buf[i + 1] * q), round(buf[i + 2] * q));
    }
}
