// ===== Patternflow pattern =====
// Title:   De Casteljau
// Family:  line
// Idea:    A Bezier curve is built the way de Casteljau's algorithm builds it: the control polygon is cut at the same fraction t along every edge, the cut points are joined into a polygon one edge shorter, and that is cut again, each step in its own colour, until one point is left that lies on the curve, while t slides back and forth, that last point draws the curve behind it, and the control points drift on slow orbits so the whole curve breathes down the 128 rows.
// Author:  patternflow-lab
// Date:    2026-11-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: de Casteljau's algorithm (Paul de Casteljau, c. 1959, at Citroen; Pierre Bezier drew the same curves at Renault in the same years), repeated linear interpolation (1 - t) P + t Q; pattern round 110
// Round:   110
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.3..3, Degree=3..7, Spread=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the control polygon and the faint hull around it are azure, each step of the algorithm is a colour further on, magenta and then orange, the curve is pale lime and the point that draws it is white. Orange and yellow are made paler so they do not dim to brown.
// Knob 2: Speed. How fast t runs. It goes 0 to 1 and back to 0, and one way takes 10 s over the knob: 5 s at 2, 33 s at 0.3 and 3.3 s at 3. The control points drift at a rate that follows it, so a slow sweep is a slow breath.
// Knob 3: Degree. The degree of the curve, from 3 to 7, a whole number: 4 to 8 control points. A degree n has n polygons, the control polygon first and the one-edge polygon last, and then the single point that is left; at 3 there are three polygons and at 7 there are seven. A control point slides out of the end or into it as the degree changes, so the curve is carried from one degree to the next.
// Knob 4: Spread. How wide the control points scatter. At 0 the zigzag they rest on is 55 percent as wide and each point wanders 4 LEDs across and 3 down; at 1 the zigzag is full width, each wanders 22 across and 16 down, and the curve loops and doubles back on itself. The two end points stay near the top and bottom edges at every setting, so the curve crosses all 128 rows.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sin, exp, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const fr = (v) => v - floor(v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}
// A colour that does not go brown: orange and yellow are paler and a little lighter.
function tint(h, s, v, out) {
  const f = fr(h);
  if (f > 0.02 && f < 0.2) {
    s *= 0.6;
    v = min(1, v * 1.2);
  }
  hsv(h, s, v, out);
}

const DMAX = 7; // the highest degree, so 8 control points
const WASH = 0.115; // how bright the hull of the control points is
const ECHO = 14; // how many earlier steps trail the sweep
const NSEG = 72; // the curve is drawn as this many straight segments

// Where each of the 8 control point slots rests and how it drifts: its own
// two rates, in radians a second at the clock, and its own two phases.
const WX = [0.31, 0.23, 0.37, 0.27, 0.34, 0.21, 0.29, 0.25];
const WY = [0.19, 0.33, 0.24, 0.36, 0.22, 0.31, 0.26, 0.2];
const PX = [0.4, 2.2, 4.1, 0.9, 5.3, 3.0, 1.7, 4.6];
const PY = [3.3, 0.7, 2.6, 5.1, 1.2, 4.4, 2.0, 0.2];
const RF = [0.5, 1, 0.85, 1, 0.75, 1, 0.9, 0.5];

// The rest place of slot i of m points: down the panel in even steps, left
// and right on a slow wave with a zigzag laid over it, so every degree has a
// control polygon that is longer than the curve it makes.
function rest(i, m, spread, out) {
  const last = m - 1, j = min(i, last), u = j / last, end = j === 0 || j === last;
  out[0] = 32 + (0.55 + 0.45 * spread) * (23 * sin(2 * PI * 1.15 * u + 0.5) + (end ? 0 : (j % 2 ? 1 : -1) * 14));
  out[1] = 4 + 119 * u;
}

export function setup(params) {
  params.s = {
    hue: 0, speed: 2, deg: 3, spread: 0.06,
    cc: 0, ph: 0, init: true,
    pos: new Float32Array(DMAX * 2 + 2),
    // The last frame's steps, kept to see that they are what the algorithm gives.
    lv: null, t: 0,
    Q: Array.from({ length: DMAX + 1 }, () => new Float32Array((DMAX + 1) * 2)),
    E: Array.from({ length: DMAX + 1 }, () => new Float32Array((DMAX + 1) * 2)),
    curve: new Float32Array((NSEG + 1) * 2),
    buf: new Float32Array(W * H * 3),
  };
}

const tmp = [0, 0];
function targets(S, out) {
  const m = S.deg + 1, rx = 4 + 18 * S.spread, ry = 3 + 13 * S.spread;
  for (let i = 0; i <= DMAX; i++) {
    rest(i, m, S.spread, tmp);
    const j = min(i, m - 1), end = j === 0 || j === m - 1;
    const k = end ? 0.35 : RF[j];
    const rr = i >= m ? 0 : 1;
    out[i * 2] = cl(tmp[0] + rr * rx * k * sin(WX[j] * S.cc + PX[j]), 3, W - 4);
    out[i * 2 + 1] = cl(tmp[1] + rr * ry * k * (end ? 0.25 : 1) * sin(WY[j] * S.cc + PY[j]), 2, H - 3);
  }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 3, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(k[0], 0, 1);
  S.speed = cl(k[1], 0.3, 3);
  S.deg = cl(round(k[2]), 3, DMAX);
  S.spread = cl(k[3], 0, 1);
  S.cc += d * S.speed * 0.8;
  S.ph += (d * S.speed) / 20;
  const tg = new Float32Array(DMAX * 2 + 2);
  targets(S, tg);
  if (S.init) {
    S.pos.set(tg);
    S.init = false;
  } else {
    const e = 1 - exp(-d * 7);
    for (let i = 0; i < DMAX * 2 + 2; i++) S.pos[i] += (tg[i] - S.pos[i]) * e;
  }
}

// de Casteljau: cut every edge of the polygon P at t, and again, until one
// point is left. lv[0] is P, lv[k] its n + 1 - k points, lv[n] the one point.
function steps(P, n, t, lv) {
  for (let i = 0; i <= n; i++) {
    lv[0][i * 2] = P[i * 2];
    lv[0][i * 2 + 1] = P[i * 2 + 1];
  }
  for (let k = 1; k <= n; k++)
    for (let i = 0; i <= n - k; i++) {
      lv[k][i * 2] = (1 - t) * lv[k - 1][i * 2] + t * lv[k - 1][(i + 1) * 2];
      lv[k][i * 2 + 1] = (1 - t) * lv[k - 1][i * 2 + 1] + t * lv[k - 1][(i + 1) * 2 + 1];
    }
}

// The convex hull of the n + 1 control points (Andrew's monotone chain), which
// the curve never leaves, as a closed list of x, y pairs.
function hull(P, n) {
  const idx = [];
  for (let i = 0; i <= n; i++) idx.push(i);
  idx.sort((a, b) => P[a * 2] - P[b * 2] || P[a * 2 + 1] - P[b * 2 + 1]);
  const cross = (o, a, b) => (P[a * 2] - P[o * 2]) * (P[b * 2 + 1] - P[o * 2 + 1]) - (P[a * 2 + 1] - P[o * 2 + 1]) * (P[b * 2] - P[o * 2]);
  const lo = [], up = [];
  for (const i of idx) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop();
    lo.push(i);
  }
  for (let q = idx.length - 1; q >= 0; q--) {
    const i = idx[q];
    while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop();
    up.push(i);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const buf = S.buf, n = S.deg;
  buf.fill(0);

  // The sweep: t goes 0 to 1 and back, easing a little at each end.
  const u = fr(S.ph), tri = 1 - abs(2 * u - 1), t = tri + 0.5 * (sm(tri) - tri);
  const P = S.pos;
  const lv = Array.from({ length: n + 1 }, () => new Float32Array((n + 1) * 2));
  steps(P, n, t, lv);
  S.lv = lv;
  S.t = t;

  const put = (x, y, c, a) => {
    if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
    const o = (y * W + x) * 3;
    const r = c[0] * a, g = c[1] * a, b = c[2] * a;
    if (r > buf[o]) buf[o] = r;
    if (g > buf[o + 1]) buf[o + 1] = g;
    if (b > buf[o + 2]) buf[o + 2] = b;
  };
  const splat = (x, y, c, a) => {
    const xi = floor(x), yi = floor(y), fx = x - xi, fy = y - yi;
    put(xi, yi, c, a * (1 - fx) * (1 - fy));
    put(xi + 1, yi, c, a * fx * (1 - fy));
    put(xi, yi + 1, c, a * (1 - fx) * fy);
    put(xi + 1, yi + 1, c, a * fx * fy);
  };
  // A line anti-aliased along its longer axis, one column or row at a time.
  const line = (x0, y0, x1, y1, c, a) => {
    const dx = x1 - x0, dy = y1 - y0;
    if (abs(dx) >= abs(dy)) {
      if (x0 > x1) return line(x1, y1, x0, y0, c, a);
      const g = dx === 0 ? 0 : dy / dx;
      for (let x = ceil(x0); x <= floor(x1); x++) {
        const y = y0 + g * (x - x0), yi = floor(y), f = y - yi;
        put(x, yi, c, a * (1 - f));
        put(x, yi + 1, c, a * f);
      }
    } else {
      if (y0 > y1) return line(x1, y1, x0, y0, c, a);
      const g = dx / dy;
      for (let y = ceil(y0); y <= floor(y1); y++) {
        const x = x0 + g * (y - y0), xi = floor(x), f = x - xi;
        put(xi, y, c, a * (1 - f));
        put(xi + 1, y, c, a * f);
      }
    }
    splat(x0, y0, c, a * 0.5);
    splat(x1, y1, c, a * 0.5);
  };
  const disc = (cx, cy, r, c, a) => {
    for (let y = floor(cy - r - 1); y <= ceil(cy + r + 1); y++)
      for (let x = floor(cx - r - 1); x <= ceil(cx + r + 1); x++) {
        const dd = Math.hypot(x - cx, y - cy);
        put(x, y, c, a * cl(r + 0.6 - dd, 0, 1));
      }
  };

  // Colours: the control polygon pale, each step a colour further round the
  // wheel, the curve a pale lime and the point that draws it white.
  const hb = 0.56 + S.hue;
  const COL = [];
  for (let k = 0; k < n; k++) {
    const c = [0, 0, 0];
    if (k === 0) tint(hb, 0.7, 1, c);
    else tint(hb + (0.5 * k) / (n - 1), 0.9, 1, c);
    COL.push(c);
  }
  const CURVE = [0, 0, 0], HEAD = [0, 0, 0];
  tint(hb + 0.68, 0.85, 1, CURVE);
  tint(hb + 0.68, 0.1, 1, HEAD);

  // The convex hull of the control points, as a faint wash: the curve stays inside it.
  {
    const hp = hull(P, n), lo = new Float32Array(H).fill(1e9), hi = new Float32Array(H).fill(-1e9);
    for (let i = 0; i < hp.length; i++) {
      const a = hp[i], b = hp[(i + 1) % hp.length];
      const ax = P[a * 2], ay = P[a * 2 + 1], bx = P[b * 2], by = P[b * 2 + 1];
      for (let y = max(0, ceil(min(ay, by))); y <= min(H - 1, floor(max(ay, by))); y++) {
        const x = by === ay ? ax : ax + ((bx - ax) * (y - ay)) / (by - ay);
        if (x < lo[y]) lo[y] = x;
        if (x > hi[y]) hi[y] = x;
        if (by === ay) {
          if (bx < lo[y]) lo[y] = bx;
          if (bx > hi[y]) hi[y] = bx;
        }
      }
    }
    for (let y = 0; y < H; y++) for (let x = max(0, ceil(lo[y])); x <= min(W - 1, floor(hi[y])); x++) put(x, y, COL[0], WASH);
  }

  // The curve: NSEG straight segments between points that de Casteljau gave,
  // the same steps at t = j / NSEG. The part t has passed is bright, and
  // brightest just behind the point; the part it has not reached is a faint
  // trace of where the point will go.
  const C = S.curve, Q = S.Q;
  for (let j = 0; j <= NSEG; j++) {
    steps(P, n, j / NSEG, Q);
    C[j * 2] = Q[n][0];
    C[j * 2 + 1] = Q[n][1];
  }
  const hx = lv[n][0], hy = lv[n][1], jt = floor(t * NSEG);
  // The swept part is two LEDs wide: the line and a fainter one beside it.
  const fat = (x0, y0, x1, y1, a) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * 0.85, ny = (dx / l) * 0.85;
    line(x0, y0, x1, y1, CURVE, a);
    line(x0 + nx, y0 + ny, x1 + nx, y1 + ny, CURVE, a * 0.45);
    line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, CURVE, a * 0.45);
  };
  for (let j = 0; j < jt; j++) fat(C[j * 2], C[j * 2 + 1], C[j * 2 + 2], C[j * 2 + 3], 0.8 + 0.2 * exp(-(t - (j + 1) / NSEG) * 6));
  fat(C[jt * 2], C[jt * 2 + 1], hx, hy, 1);
  line(hx, hy, C[(jt + 1) * 2], C[(jt + 1) * 2 + 1], CURVE, 0.14);
  for (let j = jt + 1; j < NSEG; j++) line(C[j * 2], C[j * 2 + 1], C[j * 2 + 2], C[j * 2 + 3], CURVE, 0.14);

  // Echoes: the same steps a moment earlier in the sweep, fainter each time,
  // which fans the edges of the polygons out into string art.
  const dir = u < 0.5 ? 1 : -1;
  for (let e = 1; e <= ECHO; e++) {
    const te = cl(t - dir * e * 0.02, 0, 1);
    steps(P, n, te, S.E);
    for (let k = 1; k < n; k++) {
      const pts = S.E[k], a = 0.32 * (1 - e / (ECHO + 1));
      for (let i = 0; i < n - k; i++) line(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], COL[k], a);
    }
  }

  // The polygons, the control polygon dimmest, then each step.
  for (let k = 0; k < n; k++) {
    const a = k === 0 ? 0.5 : 0.8;
    const pts = lv[k];
    for (let i = 0; i < n - k; i++) {
      const x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[i * 2 + 2], y1 = pts[i * 2 + 3];
      line(x0, y0, x1, y1, COL[k], a);
      if (k > 0) {
        const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = (-dy / l) * 0.9, ny = (dx / l) * 0.9;
        line(x0 + nx, y0 + ny, x1 + nx, y1 + ny, COL[k], a * 0.28);
        line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, COL[k], a * 0.28);
      }
    }
  }
  // The cut points of each step.
  for (let k = 0; k < n; k++) {
    const pts = lv[k];
    for (let i = 0; i <= n - k; i++) disc(pts[i * 2], pts[i * 2 + 1], k === 0 ? 1.7 : 1.1, COL[k], 1);
  }
  // The point left at the end of the steps, on the curve.
  disc(lv[n][0], lv[n][1], 3.4, CURVE, 0.3);
  disc(lv[n][0], lv[n][1], 2.1, HEAD, 1);

  for (let p = 0; p < W * H; p++) display.setPixel(p & 63, p >> 6, min(255, buf[p * 3] * 255), min(255, buf[p * 3 + 1] * 255), min(255, buf[p * 3 + 2] * 255));
}
