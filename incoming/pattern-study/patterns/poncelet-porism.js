// ===== Patternflow pattern =====
// Title:   Poncelet Porism
// Family:  line
// Idea:    Three polygons with their corners on a tall ellipse and every side tangent to a smaller ellipse inside it slide round together in three colours, the corners creeping past the end where the inner ellipse comes close and racing round the far end, and each one closes from wherever it starts.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Poncelet's porism (Jean-Victor Poncelet, 1822), with Euler's relation for triangles (Leonhard Euler, 1765) and Fuss's for quadrilaterals (Nicolas Fuss, 1798), pattern round 41
// Round:   41
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Shape=0..5, Centre=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together, a fifth of the wheel apart. At 0 cyan, violet and pink, and the inner ellipse, where all three fills overlap, pale lavender; at 0.25 violet, rose and pale yellow; at 0.5 red, yellow-green and green. A polygon that comes round between orange and yellow-green is paled and its fill raised from 42% to 60%, so it never reads brown or olive.
// Knob 2: Speed. At 2 each corner goes once round the circles in 12 seconds while the two circles turn once round the centre in 64, so the end where the corners crowd wanders round the panel; at 0.2 that is 120 and 640 seconds, at 3 8 and 43.
// Knob 3: Shape. Six polygons: 0 triangles, 1 quadrilaterals, 2 pentagrams {5/2}, 3 heptagrams {7/2}, 4 heptagrams {7/3}, 5 octagrams {8/3}, whose sides wind round the inner circle 2 or 3 times before they close. Fills are even-odd, so the pentagram and the {7/2} leave the middle round the inner ellipse dark and the {7/3} and {8/3} light it again. From 3 up two polygons instead of three.
// Knob 4: Centre. How near the centre the inner circle sits, set as the fastest corner against the slowest: 3.4 times at 0, 3.24 at the opening 0.06, where a corner creeps past the near end at 7.5 LEDs a second and races past the far end at 39; 2.1 times at 0.5; at 1 the circles are concentric, the polygons are regular ones seen through the stretch and only the stretch changes a corner's pace, 14.7 to 29.3 LEDs a second. The inner radius comes from Euler's relation for triangles, d^2 = R^2 - 2Rr, Fuss's for quadrilaterals and bisection on the closing gap for the stars; at the opening the triangles' inner circle is 0.414 of the outer one and sits 0.415 of it off centre.
// Buttons: K1 tap swings both circles half a turn round the centre in 1.6 seconds, carrying the crowded end to the far end of the panel, and every polygon stays closed through the swing.

const W = 64, H = 128;
const { floor, min, max, sqrt, asin, atan2, cos, sin, round, hypot, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = [v, q, p, p, t, v][i];
  out[1] = [t, v, v, q, p, p][i];
  out[2] = [p, p, t, v, v, q][i];
}

// The two circles: the outer one of radius 1 at the origin, the inner one of
// radius r centred (0, e). The panel shows them through the affine map
// x -> CX + S x, y -> CY + 2 S y, turned by phi first, which keeps every
// corner on the outer ellipse and every side tangent to the inner one.
const S = 28, CX = 31.5, CY = 63.5;
// The polygons K3 steps through, as [corners, turns]: a triangle, a
// quadrilateral, then the stars {5/2}, {7/2}, {7/3} and {8/3}, whose sides
// go round the inner circle two or three times before they close.
const SHAPES = [[3, 1], [4, 1], [5, 2], [7, 2], [7, 3], [8, 3]];
// Polygons on the panel at once, and the samples of the table that turns the
// invariant parameter into an angle.
const POLYS = 3, M = 512;
// Line half-width and corner disc radius, in LEDs.
const HW = 1.25, DISC = 3.3;
// Opening hues: cyan, violet, pink, a fifth of the wheel apart.
const HUE0 = 0.5, SPREAD = 0.2;

// One Poncelet step from angle th on the outer circle: the tangent from that
// point to the inner circle, on the side that turns counterclockwise, meets
// the outer circle again at th + the returned advance, in (0, 2 pi).
function advance(th, e, r) {
  const px = cos(th), py = sin(th), wx = -px, wy = e - py, D = hypot(wx, wy);
  const a = -asin(cl(r / D, -1, 1)), ca = cos(a), sa = sin(a);
  const ux = (wx * ca - wy * sa) / D, uy = (wx * sa + wy * ca) / D;
  const t = -2 * (px * ux + py * uy);
  const d = atan2(py + t * uy, px + t * ux) - th;
  return d - floor(d / TAU) * TAU;
}

// How far n steps overshoot k whole turns. It has one sign for every start
// unless the polygon closes, so bisection on r finds the closing circle.
function overshoot(e, r, n, k) {
  let th = 0.3, s = 0;
  for (let i = 0; i < n; i++) {
    const d = advance(th, e, r);
    s += d;
    th += d;
  }
  return s - TAU * k;
}

function closingRadius(e, n, k) {
  let lo = 0, hi = 1 - e;
  for (let i = 0; i < 52; i++) {
    const m = (lo + hi) / 2;
    if (overshoot(e, m, n, k) > 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// A corner moves along the outer circle as fast as the tangent from it to the
// inner circle is long, so the longest tangent over the shortest is the
// fastest corner against the slowest.
const ratioAt = (e, r) => sqrt((1 + e) ** 2 - r * r) / sqrt(max(1e-12, (1 - e) ** 2 - r * r));

function solve(P, n, k, rho) {
  let lo = 0, hi = 0.95;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (ratioAt(m, closingRadius(m, n, k)) < rho) lo = m;
    else hi = m;
  }
  P.e = (lo + hi) / 2;
  P.r = closingRadius(P.e, n, k);
  // The invariant parameter: the integral of d theta over the tangent length,
  // scaled to 1 round the circle. Each Poncelet step adds exactly k/n to it.
  const { e, r, tab } = P, L = (th) => 1 / sqrt(1 + e * e - 2 * e * sin(th) - r * r);
  let acc = 0;
  tab[0] = 0;
  for (let i = 0; i < M; i++) {
    const a = (TAU * i) / M, b = (TAU * (i + 1)) / M;
    acc += ((b - a) / 6) * (L(a) + 4 * L((a + b) / 2) + L(b));
    tab[i + 1] = acc;
  }
  for (let i = 0; i <= M; i++) tab[i] /= acc;
}

function angleOf(tab, s) {
  s -= floor(s);
  let lo = 0, hi = M;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (tab[m] <= s) lo = m;
    else hi = m;
  }
  return (TAU * (lo + (s - tab[lo]) / max(1e-12, tab[lo + 1] - tab[lo]))) / M;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, shape: 0, rho: 0, key: '', e: 0, r: 0.5, tab: new Float64Array(M + 1),
    t: 0, phi: 0, swing: 0, from: 0,
    vx: new Float32Array(POLYS * 8), vy: new Float32Array(POLYS * 8), xs: new Float32Array(8),
    rgb: new Float32Array(W * H * 3), col: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], fill: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0];
  P.speed = cl(k[1], 0.2, 3);
  P.shape = round(cl(k[2], 0, 5));
  P.rho = 1 + 2.4 * (1 - cl(k[3], 0, 1)) ** 1.1;
  const key = P.shape + ':' + P.rho.toFixed(4);
  if (key !== P.key) {
    const [n, t] = SHAPES[P.shape];
    solve(P, n, t, P.rho);
    P.key = key;
  }
  if (input.btnPressed && input.btnPressed[0] && P.swing <= 0) {
    P.swing = 1;
    P.from = P.phi;
  }
  // The corners go round once in 12 seconds at Speed 2, and the pair of
  // circles turns once in 64, so the side where the corners crowd wanders.
  // A swing adds half a turn over 1.6 seconds on top of that.
  const turn = (d * P.speed * TAU) / 128;
  P.t += (d * P.speed) / 24;
  if (P.swing > 0) {
    P.from += turn;
    P.swing = max(0, P.swing - d / 1.6);
    P.phi = P.from + PI * sm(0, 1, 1 - P.swing);
  } else P.phi += turn;
}

// Paint value a of colour c over the buffer at q.
function over(rgb, q, c, a, wh) {
  rgb[q] += (c[0] + (1 - c[0]) * wh - rgb[q]) * a;
  rgb[q + 1] += (c[1] + (1 - c[1]) * wh - rgb[q + 1]) * a;
  rgb[q + 2] += (c[2] + (1 - c[2]) * wh - rgb[q + 2]) * a;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const { e, r, tab, vx, vy, xs, rgb, col, fill } = P, [n, turns] = SHAPES[P.shape];
  const cp = cos(P.phi), sp = sin(P.phi);
  // Three polygons, or two of the seven- and eight-cornered stars, which
  // would otherwise draw 21 or 24 sides.
  const polys = n < 7 ? POLYS : 2;
  for (let j = 0; j < polys; j++) {
    const h = P.hue + HUE0 + (j * SPREAD * 2) / (polys - 1), hh = h - floor(h);
    const warm = sm(0.0, 0.06, hh) * (1 - sm(0.17, 0.24, hh));
    hsv(h, 0.85 - 0.35 * warm, 1, col[j]);
    const f = 0.42 + 0.18 * warm;
    for (let c = 0; c < 3; c++) fill[j][c] = col[j][c] * f;
    // The first corner rides the invariant parameter; the rest are the
    // Poncelet steps from it.
    let th = angleOf(tab, P.t + j / (polys * n));
    for (let i = 0; i < n; i++) {
      const x = cos(th), y = sin(th);
      vx[j * 8 + i] = CX + S * (x * cp - y * sp);
      vy[j * 8 + i] = CY + 2 * S * (x * sp + y * cp);
      th += advance(th, e, r);
    }
  }
  rgb.fill(0);
  // Fills, even-odd, added: a triangle is filled whole, a star has its points
  // filled and its middle left open, and where several overlap they sum.
  for (let j = 0; j < polys; j++) {
    const o = j * 8, f = fill[j];
    for (let y = 0; y < H; y++) {
      const yc = y + 0.5;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const ax = vx[o + i], ay = vy[o + i], bx = vx[o + ((i + 1) % n)], by = vy[o + ((i + 1) % n)];
        if ((ay <= yc) === (by <= yc)) continue;
        const x = ax + ((yc - ay) * (bx - ax)) / (by - ay);
        let p = m++;
        for (; p > 0 && xs[p - 1] > x; p--) xs[p] = xs[p - 1];
        xs[p] = x;
      }
      for (let i = 0; i + 1 < m; i += 2) {
        const xa = xs[i], xb = xs[i + 1];
        for (let x = max(0, floor(xa)); x <= min(W - 1, floor(xb)); x++) {
          const a = min(x + 1, xb) - max(x, xa);
          if (a <= 0) continue;
          const q = (y * W + x) * 3;
          rgb[q] += f[0] * a;
          rgb[q + 1] += f[1] * a;
          rgb[q + 2] += f[2] * a;
        }
      }
    }
  }
  // Sides, laid over the fills in each polygon's full colour. For each row
  // only the stretch of the band within reach of the line is visited.
  const R = HW + 1;
  for (let j = 0; j < polys; j++) {
    const o = j * 8, c = col[j];
    for (let i = 0; i < n; i++) {
      const ax = vx[o + i], ay = vy[o + i], bx = vx[o + ((i + 1) % n)], by = vy[o + ((i + 1) % n)];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, l = sqrt(l2), nx = -dy / l, ny = dx / l;
      const xmin = min(ax, bx) - R, xmax = max(ax, bx) + R;
      for (let y = max(0, floor(min(ay, by) - R)); y <= min(H - 1, floor(max(ay, by) + R)); y++) {
        const py = y + 0.5;
        let x0 = xmin, x1 = xmax;
        if (nx > 0.02 || nx < -0.02) {
          const u = (-R - ny * (py - ay)) / nx + ax, v = (R - ny * (py - ay)) / nx + ax;
          x0 = max(x0, min(u, v));
          x1 = min(x1, max(u, v));
        }
        for (let x = max(0, floor(x0)); x <= min(W - 1, floor(x1)); x++) {
          const px = x + 0.5 - ax, qy = py - ay, u = cl((px * dx + qy * dy) / l2, 0, 1);
          const a = cl(HW + 0.5 - hypot(px - u * dx, qy - u * dy), 0, 1);
          if (a > 0) over(rgb, (y * W + x) * 3, c, a, 0);
        }
      }
    }
  }
  // Corners: a disc of the polygon's colour with a white heart.
  for (let j = 0; j < polys; j++) {
    const o = j * 8, c = col[j];
    for (let i = 0; i < n; i++) {
      const cx = vx[o + i], cy = vy[o + i];
      for (let y = max(0, floor(cy - DISC - 1)); y <= min(H - 1, floor(cy + DISC + 1)); y++)
        for (let x = max(0, floor(cx - DISC - 1)); x <= min(W - 1, floor(cx + DISC + 1)); x++) {
          const dd = hypot(x + 0.5 - cx, y + 0.5 - cy), a = cl(DISC + 0.5 - dd, 0, 1);
          if (a > 0) over(rgb, (y * W + x) * 3, c, a, sm(DISC - 0.6, 0.6, dd) * 0.85);
        }
    }
  }
  for (let y = 0, q = 0; y < H; y++)
    for (let x = 0; x < W; x++, q += 3) display.setPixel(x, y, round(255 * min(1, rgb[q])), round(255 * min(1, rgb[q + 1])), round(255 * min(1, rgb[q + 2])));
}
