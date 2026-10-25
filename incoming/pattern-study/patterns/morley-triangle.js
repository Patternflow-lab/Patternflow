// ===== Patternflow pattern =====
// Title:   Morley Triangle
// Family:  geometry
// Idea:    A triangle bigger than the panel is wide keeps changing shape, and the three points where the angle trisectors next to each side meet always form an equilateral triangle, filled bright gold among the six flat triangles the trisectors cut, turning, growing and shrinking while the big one writhes.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Morley's trisector theorem (Frank Morley, 1899), pattern round 42
// Round:   42
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Wander=0..1, Exterior=0..1
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 the equilateral triangle is gold and the three triangles on the sides of the big one are teal, blue and magenta; the rest of the big triangle stays dim slate at every hue, and a side triangle that lands between orange and yellow is paled and lifted so it does not read brown.
// Knob 2: Speed. How fast the shape changes. At 2 the angles swing from about 60, 60, 60 out to their widest and back in about 10 seconds; at 0.2 it takes 95 seconds, at 3 about 6.
// Knob 3: Wander. How far the angles roam. At 0 they stay between 31 and 103 degrees and the equilateral triangle's side between 14 and 21 LEDs; at 1 they reach 12 and 132 degrees, a sliver lying along the panel's diagonal whose Morley triangle shrinks to 6 LEDs a side.
// Knob 4: Exterior. Draws the exterior Morley triangle behind the big one: the points where the trisectors of the exterior angles meet beyond each side, also always equilateral, its sides parallel to the inner one's and 7 to 17 times as long, so mostly its edges cross the panel. Up to 0.1 nothing; its edge comes up to full by 0.6, and from 0.4 a dim fill grows inside it.

const W = 64, H = 128;
const { floor, min, max, sqrt, abs, sin, cos, round, PI } = Math;
const TAU = 2 * PI, DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Smallest and largest angle the triangle may take at Wander 1, in degrees.
const AMIN = 12, AMAX = 132;
// How far past the panel's edge the triangle's box may reach, in LEDs: a
// corner may leave the panel sideways by up to OX and up or down by up to OY.
const OX = 12, OY = 2;

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, wander: 0, ext: 0.06,
    tau: 0, theta: NaN,
    ang: new Float64Array(3),
    // Panel corners A, B, C, the Morley points P (by BC), Q (by CA), R (by AB)
    // and the exterior ones P', Q', R'.
    v: new Float64Array(6), m: new Float64Array(6), e: new Float64Array(6),
    lab: new Uint8Array(W * H), col: new Float32Array(9 * 3), colHue: NaN,
  };
}

// The angles at time tau: a point in the plane a + b + c = 180 that swings
// out from 60, 60, 60 toward a corner or an edge of the allowed region and
// back, turning as it goes so every vertex takes its turn at being obtuse.
function angles(S) {
  const t = S.tau, roam = 0.6 + 0.4 * S.wander;
  const phi = 0.23 * t + 1.3 * sin(0.071 * t + 0.4);
  const e = 0.55 - 0.45 * cos(0.47 * t + 0.9 * sin(0.13 * t) + 0.9);
  const c = [cos(phi), cos(phi - TAU / 3), cos(phi + TAU / 3)];
  let rmax = 1e9;
  for (const ck of c) rmax = min(rmax, ck > 0 ? (AMAX - 60) / ck : ck < 0 ? (60 - AMIN) / -ck : 1e9);
  const rho = roam * e * rmax;
  for (let k = 0; k < 3; k++) S.ang[k] = 60 + rho * c[k];
}

// The triangle with these angles, side V0V1 of length 1, about its centroid.
function canonical(ang) {
  const [a, b, c] = ang, L = sin(b * DEG) / sin(c * DEG);
  const x = [0, 1, L * cos(a * DEG)], y = [0, 0, L * sin(a * DEG)];
  const gx = (x[0] + x[1] + x[2]) / 3, gy = (y[0] + y[1] + y[2]) / 3;
  return [x[0] - gx, y[0] - gy, x[1] - gx, y[1] - gy, x[2] - gx, y[2] - gy];
}

// The scale at which the triangle, turned by th, just fits inside the panel.
function fit(T, th) {
  const c = cos(th), s = sin(th);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let k = 0; k < 3; k++) {
    const x = T[2 * k] * c - T[2 * k + 1] * s, y = T[2 * k] * s + T[2 * k + 1] * c;
    x0 = min(x0, x), x1 = max(x1, x), y0 = min(y0, y), y1 = max(y1, y);
  }
  return { k: min((W + 2 * OX) / (x1 - x0), (H + 2 * OY) / (y1 - y0)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Where the ray from p along d meets the ray from q along e.
function meet(px, py, dx, dy, qx, qy, ex, ey, out, o) {
  const den = dx * ey - dy * ex, t = ((qx - px) * ey - (qy - py) * ex) / den;
  out[o] = px + t * dx;
  out[o + 1] = py + t * dy;
}

// The trisector from vertex i nearest the side towards vertex j: the unit
// vector from i to j turned a third of the angle at i towards the third
// vertex, or with ext a third of the exterior angle, 180 less the angle,
// away from it.
function trisector(v, ang, i, j, out, ext) {
  const k = 3 - i - j;
  let ux = v[2 * j] - v[2 * i], uy = v[2 * j + 1] - v[2 * i + 1];
  const ul = sqrt(ux * ux + uy * uy);
  ux /= ul;
  uy /= ul;
  const wx = v[2 * k] - v[2 * i], wy = v[2 * k + 1] - v[2 * i + 1], dp = wx * ux + wy * uy;
  let nx = wx - dp * ux, ny = wy - dp * uy;
  const nl = sqrt(nx * nx + ny * ny);
  nx /= ext ? -nl : nl;
  ny /= ext ? -nl : nl;
  const t = ((ext ? 180 - ang[i] : ang[i]) * DEG) / 3;
  out[0] = ux * cos(t) + nx * sin(t);
  out[1] = uy * cos(t) + ny * sin(t);
}

const PAIRS = [[1, 2], [2, 1], [2, 0], [0, 2], [0, 1], [1, 0]];
const D = [new Float64Array(2), new Float64Array(2), new Float64Array(2), new Float64Array(2), new Float64Array(2), new Float64Array(2)];

function place(S, d) {
  angles(S);
  const T = canonical(S.ang);
  // Turn towards the angle at which the triangle fits largest, preferring
  // angles near the current one so it does not flip between equal fits.
  if (S.theta !== S.theta) {
    let top = -1;
    for (let n = 0; n < 90; n++) {
      const th = (n / 90) * PI, sc = fit(T, th).k;
      if (sc > top) (top = sc), (S.theta = th);
    }
  }
  let best = -1, target = S.theta;
  for (let n = 0; n < 60; n++) {
    const th = S.theta + ((n - 30) / 30) * (PI / 2), u = (th - S.theta) / (PI / 2);
    const sc = fit(T, th).k * (1 - 0.22 * u * u);
    if (sc > best) (best = sc), (target = th);
  }
  S.theta += (target - S.theta) * min(1, d);
  const F = fit(T, S.theta), c = cos(S.theta), s = sin(S.theta);
  for (let k = 0; k < 3; k++) {
    const x = T[2 * k] * c - T[2 * k + 1] * s, y = T[2 * k] * s + T[2 * k + 1] * c;
    S.v[2 * k] = W / 2 + (x - F.cx) * F.k;
    S.v[2 * k + 1] = H / 2 + (y - F.cy) * F.k;
  }
  // Morley points: P where the trisectors of B and C next to BC meet, Q for
  // C and A next to CA, R for A and B next to AB; then the same with the
  // exterior trisectors, P', Q' and R' beyond the sides.
  const v = S.v, a = S.ang;
  for (const [ext, out] of [[false, S.m], [true, S.e]]) {
    for (let n = 0; n < 6; n++) trisector(v, a, PAIRS[n][0], PAIRS[n][1], D[n], ext);
    for (let n = 0; n < 3; n++) {
      const i = PAIRS[2 * n][0], j = PAIRS[2 * n][1];
      meet(v[2 * i], v[2 * i + 1], D[2 * n][0], D[2 * n][1], v[2 * j], v[2 * j + 1], D[2 * n + 1][0], D[2 * n + 1][1], out, 2 * n);
    }
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.wander = cl(k[2], 0, 1);
  S.ext = cl(k[3], 0, 1);
  S.tau += d * S.speed * 0.7;
  place(S, d * (0.6 + 0.6 * S.speed));
}

// Inside test for triangle p0 p1 p2 at (x, y), either winding.
function inside(x, y, ax, ay, bx, by, cx, cy) {
  const e0 = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
  const e1 = (cx - bx) * (y - by) - (cy - by) * (x - bx);
  const e2 = (ax - cx) * (y - cy) - (ay - cy) * (x - cx);
  return (e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0);
}

function palette(S) {
  const col = S.col, h0 = S.hue + 0.13;
  // 1 Morley, 2..4 the side triangles, 5 the dim rest, 6 the rim of ABC,
  // 7 the rim of the exterior Morley triangle.
  hsv(h0, 0.62, 1, col, 3);
  const sides = [0.34, 0.49, 0.71];
  for (let n = 0; n < 3; n++) {
    const h = h0 + sides[n], hf = h - floor(h), band = max(0, 1 - abs(hf - 0.12) / 0.13);
    hsv(h, 0.82 - 0.25 * band, 0.62 + 0.3 * band, col, 6 + 3 * n);
  }
  // The dim rest stays slate whatever the hue: a dim warm colour reads brown.
  hsv(0.68, 0.5, 0.19, col, 15);
  hsv(h0 + 0.55, 0.25, 0.8, col, 18);
  hsv(h0, 0.35, 1, col, 21);
  S.colHue = S.hue;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  if (S.colHue !== S.hue) palette(S);
  const { v, m, e, lab, col } = S;
  const [ax, ay, bx, by, cx, cy] = v, [px, py, qx, qy, rx, ry] = m;
  const amt = sm(0.1, 0.6, S.ext), fill = 0.8 * sm(0.4, 1, S.ext);
  // Edge lines of the exterior Morley triangle as unit normals pointing in,
  // so a point's distance inside is the least of three dot products.
  const nrm = [];
  if (amt > 0) {
    const turn = (e[2] - e[0]) * (e[5] - e[1]) - (e[3] - e[1]) * (e[4] - e[0]) > 0 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      const x0 = e[2 * k], y0 = e[2 * k + 1], x1 = e[(2 * k + 2) % 6], y1 = e[(2 * k + 3) % 6], L = sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
      nrm.push([(-(y1 - y0) * turn) / L, ((x1 - x0) * turn) / L, x0, y0]);
    }
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const X = x + 0.5, Y = y + 0.5;
      let l = 0;
      if (inside(X, Y, ax, ay, bx, by, cx, cy)) {
        if (inside(X, Y, px, py, qx, qy, rx, ry)) l = 1;
        else if (inside(X, Y, bx, by, cx, cy, px, py)) l = 2;
        else if (inside(X, Y, cx, cy, ax, ay, qx, qy)) l = 3;
        else if (inside(X, Y, ax, ay, bx, by, rx, ry)) l = 4;
        else l = 5;
      }
      lab[y * W + x] = l;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x, l = lab[p];
      let r = 0, g = 0, b = 0;
      if (l > 0) {
        let o = l * 3;
        if ((x > 0 && lab[p - 1] === 0) || (x < W - 1 && lab[p + 1] === 0) || (y > 0 && lab[p - W] === 0) || (y < H - 1 && lab[p + W] === 0)) o = 18;
        (r = col[o]), (g = col[o + 1]), (b = col[o + 2]);
      } else if (amt > 0) {
        // Behind the triangle, the exterior Morley triangle: an edge two
        // LEDs wide in the hero's colour, paled, and a dim fill.
        let d = 1e9;
        for (const [nx, ny, x0, y0] of nrm) d = min(d, (x + 0.5 - x0) * nx + (y + 0.5 - y0) * ny);
        if (d >= 0 && d < 1.6) (r = col[21] * amt), (g = col[22] * amt), (b = col[23] * amt);
        else if (d >= 1.6) (r = col[15] * fill), (g = col[16] * fill), (b = col[17] * fill);
      }
      display.setPixel(x, y, round(255 * min(1, r)), round(255 * min(1, g)), round(255 * min(1, b)));
    }
}
