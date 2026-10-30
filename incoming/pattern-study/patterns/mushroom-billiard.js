// ===== Patternflow pattern =====
// Title:   Mushroom Billiard
// Family:  particle
// Idea:    A mushroom-shaped billiard stands up the panel, a half disc of radius 30 on top of a straight stem that runs down to the floor, and 360 balls bounce in it with short trails, gold where a ball's chord passes the cap's centre further off than half the stem's width, so that it circles the cap for ever tangent to its caustic and never finds the way down, and blue for every other ball, which wanders the stem and the cap alike, the two kinds parted exactly by that one distance.
// Author:  patternflow-lab
// Date:    2026-10-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: mushroom billiards (Leonid Bunimovich, Mushrooms and other billiards with divided phase space, Chaos 11, 2001), pattern round 79
// Round:   79
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Stem=0.3..0.9, Trail=0..1
//
// Knob 1: Hue. Turns both kinds round the wheel together. At 0 the regular balls run from amber on the caustics just outside the border to lemon on the ones nearest the rim, and the chaotic ones are azure; at 0.5 the regular balls are blue and the chaotic ones orange.
// Knob 2: Speed. At 2 a ball flies 40 LEDs a second, so one going straight down would run the stem's 95 rows in 2.4 s; at 0.2 it flies 4 and at 3, 60. In a two-minute run at 2 every chaotic ball went down the stem and no regular one did, its |L| drifting by less than a trillionth of an LED.
// Knob 3: Stem. The stem's half width as a share of the cap's radius: 9 LEDs (an 18 LED stem) at the opening 0.3, 18 at 0.6, 27 at 0.9, where the cap is left only a 3 LED brim each side. The border moves with it, and a regular ball whose caustic is now inside it turns blue at once and will find the stem; one that the narrower stem shuts out turns gold.
// Knob 4: Trail. How long a path stays lit. At the opening 0.06 a ball draws a streak about 5 LEDs long; at 1 a path fades over 1.55 s, too faint to see alone, and the paths add up to a haze in which the regular balls' chords make a gold band round the rim that never comes inside the dotted border.
// Buttons: K1 tap throws every ball again, two in five regular, each kind spread evenly over its own part of the table's phase space.

// A ball in a disc keeps the distance L from the centre to the line it
// flies along: a bounce off the circle turns its heading but not that line's
// distance, so every chord is tangent to one circle of radius |L|, its
// caustic. A bounce off a mirror through the centre turns L into -L. The cap
// here is a half disc whose flat side is such a mirror, so in the cap |L| is
// kept too. The stem hangs from the middle of the flat side, |x| < a.
//
// Leonid Bunimovich saw what that does. A ball's line meets the flat side
// at a distance |L| / |sin phi| from the centre, never closer than |L|. If
// |L| > a it never meets the opening, never goes down the stem, and circles
// the cap for ever: a regular, integrable orbit. If |L| < a the lines turn
// round from bounce to bounce and sooner or later one crosses the opening;
// down in the stem the walls and the floor scatter it, and it comes back up
// with a new L that is again smaller than a, since it came up through the
// opening. Those balls are chaotic and wander everywhere. The phase space is
// split in two by the one number |L| = a: a sharp border, with no chains of
// smaller islands round the regular part as most billiards with both kinds
// of motion have.
//
// The kind of a ball is decided by exactly that: in the cap and |L| > a is
// regular, anything else is chaotic. The balls start two in five regular,
// spread evenly over the cap's positions and headings with |L| > a, and the
// rest spread evenly over the positions and headings of the whole table
// with |L| < a in the cap, so each kind starts in its own invariant measure
// and the picture has nothing left to settle into. Every bounce is worked out exactly: the
// arc, the flat underside of the cap on both sides of the stem, the stem's
// walls and its floor, each a mirror.

const W = 64, H = 128, N = W * H;
const CX = 32, CY = 31.5, R = 30, HS = 95, EPS = 1e-9;
const { min, max, floor, ceil, sqrt, exp, cos, sin, abs, round, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// 360 balls, two in five regular at a throw. VEL LEDs a second per unit of
// Speed. The table's outline and the dotted border circle |L| = a in the
// cap sit just above the 24/255 an LED needs to count as lit.
const NB = 360, REG = 0.4, VEL = 20;
const RIM = 0.11, BORDER = 0.12;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  out[o] = [v, q, p, p, t, v][i];
  out[o + 1] = [t, v, v, q, p, p][i];
  out[o + 2] = [p, p, t, v, v, q][i];
}

// Inside the table, at least m from its walls (m < 0: within -m outside).
function inside(a, x, y, m) {
  if (y >= 0) return x * x + y * y <= (R - m) * (R - m) && (y >= m || abs(x) <= a - m);
  return y >= -HS + m && abs(x) <= a - m;
}

// Where along (dx, dy) a ball at (x, y) meets the next wall, and the
// wall's normal there. The ball's own y >= 0 means it is in the cap.
const HIT = [0, 0, 0];
function hit(a, x, y, dx, dy) {
  let t = Infinity, nx = 0, ny = 0;
  // The arc: the far root of |p + t d| = R, landing on the upper half.
  const b = x * dx + y * dy, c = x * x + y * y - R * R, d = b * b - c;
  if (d >= 0) {
    const u = -b + sqrt(d);
    if (u > EPS && y + u * dy >= 0) (t = u), (nx = x + u * dx), (ny = y + u * dy);
  }
  if (dy < 0) {
    // The cap's flat underside, a <= |x| <= R on the line y = 0.
    if (y >= 0) {
      const u = -y / dy, hx = abs(x + u * dx);
      if (u > EPS && u < t && hx >= a) (t = u), (nx = 0), (ny = 1);
    }
    // The floor of the stem.
    const u = (-HS - y) / dy;
    if (u > EPS && u < t && abs(x + u * dx) <= a) (t = u), (nx = 0), (ny = 1);
  }
  // The stem's walls, x = +-a below the flat side.
  if (dx !== 0) {
    const u = ((dx > 0 ? a : -a) - x) / dx, hy = y + u * dy;
    if (u > EPS && u < t && hy <= 0 && hy >= -HS) (t = u), (nx = 1), (ny = 0);
  }
  const n = sqrt(nx * nx + ny * ny) || 1;
  HIT[0] = t;
  HIT[1] = nx / n;
  HIT[2] = ny / n;
}

// A new ball of the given kind, spread evenly over that kind's part of the
// phase space: position even over the area, heading even over the circle.
function throwBall(P, i, regular) {
  const a = P.a, capA = (PI * R * R) / 2, stemA = 2 * a * HS;
  for (let k = 0; k < 20000; k++) {
    let x, y;
    if (regular || Math.random() * (capA + stemA) < capA) {
      x = (Math.random() * 2 - 1) * R;
      y = Math.random() * R;
      if (x * x + y * y > (R - 0.3) * (R - 0.3)) continue;
    } else {
      x = (Math.random() * 2 - 1) * (a - 0.3);
      y = -Math.random() * (HS - 0.3);
    }
    const th = Math.random() * 2 * PI, dx = cos(th), dy = sin(th), L = abs(x * dy - y * dx);
    if (y >= 0 && L > a !== regular) continue;
    P.x[i] = x;
    P.y[i] = y;
    P.dx[i] = dx;
    P.dy[i] = dy;
    return;
  }
  P.x[i] = 0;
  P.y[i] = -HS / 2;
  P.dx[i] = 0.6;
  P.dy[i] = 0.8;
}

function throwAll(P) {
  for (let i = 0; i < NB; i++) throwBall(P, i, i < NB * REG);
}

// The kind and colour of ball i: regular balls by where their caustic lies
// between the border and the rim, chaotic ones all one colour.
function paint(P, i) {
  const x = P.x[i], y = P.y[i], L = abs(x * P.dy[i] - y * P.dx[i]), a = P.a;
  if (y >= 0 && L > a) hsv(P.hue + 0.1 + 0.07 * ((L - a) / (R - a)), 0.9, 1, P.col, i * 3);
  else hsv(P.hue + 0.57, 0.8, 1, P.col, i * 3);
}

// Lights the LEDs a ball passes between (x0, y0) and (x1, y1), each once,
// w0 at the start fading up to w1 at the end.
function trail(P, i, x0, y0, x1, y1, w0, w1) {
  const n = max(1, ceil(sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) / 0.6)), buf = P.buf, c = i * 3;
  const cr = P.col[c], cg = P.col[c + 1], cb = P.col[c + 2];
  for (let j = 1; j <= n; j++) {
    const t = j / n, X = floor(CX + x0 + (x1 - x0) * t), Y = floor(CY - (y0 + (y1 - y0) * t));
    const p = cl(Y, 0, H - 1) * W + cl(X, 0, W - 1);
    if (p === P.lastp) continue;
    P.lastp = p;
    const w = w0 + (w1 - w0) * t, q = p * 3;
    buf[q] += cr * w;
    buf[q + 1] += cg * w;
    buf[q + 2] += cb * w;
  }
}

// Ball i flies s LEDs, bouncing off the walls as a mirror.
function fly(P, i, s, w0, w1) {
  const a = P.a;
  let x = P.x[i], y = P.y[i], dx = P.dx[i], dy = P.dy[i], done = 0;
  for (let k = 0; k < 32 && done < s; k++) {
    hit(a, x, y, dx, dy);
    const bounce = HIT[0] < s - done, t = bounce ? HIT[0] : s - done;
    const x1 = x + t * dx, y1 = y + t * dy;
    trail(P, i, x, y, x1, y1, w0 + ((w1 - w0) * done) / s, w0 + ((w1 - w0) * (done + t)) / s);
    x = x1;
    y = y1;
    done += t;
    if (bounce) {
      const nx = HIT[1], ny = HIT[2], d = dx * nx + dy * ny;
      dx -= 2 * d * nx;
      dy -= 2 * d * ny;
      const n = sqrt(dx * dx + dy * dy);
      dx /= n;
      dy /= n;
    }
  }
  P.x[i] = x;
  P.y[i] = y;
  P.dx[i] = dx;
  P.dy[i] = dy;
  // Rounding can, very rarely, slip a ball out past a corner of the stem;
  // it is thrown again, into the stem's kind.
  if (!inside(a, x, y, -0.05)) throwBall(P, i, false);
}

// The outline of the table and the border circle |L| = a in the cap.
function table(P) {
  const a = P.a, m = P.rim;
  m.fill(0);
  const put = (x, y, v) => {
    const p = cl(floor(CY - y), 0, H - 1) * W + cl(floor(CX + x), 0, W - 1);
    if (v > m[p]) m[p] = v;
  };
  const o = 0.7;
  for (let k = 0; k <= 600; k++) {
    const t = (k / 600) * PI;
    put((R + o) * cos(t), (R + o) * sin(t), RIM);
  }
  for (let x = a + o; x <= R + o; x += 0.5) put(x, -o, RIM), put(-x, -o, RIM);
  for (let y = -o; y >= -HS - o; y -= 0.5) put(a + o, y, RIM), put(-a - o, y, RIM);
  for (let x = -a - o; x <= a + o; x += 0.5) put(x, -HS - o, RIM);
  // The border, dotted: no regular ball's chord comes inside it.
  for (let k = 0; k <= 40; k++) {
    const t = (k / 40) * PI;
    put(a * cos(t), a * sin(t), BORDER);
  }
}

export function setup(params) {
  const F64 = (n) => new Float64Array(n);
  params.s = {
    x: F64(NB), y: F64(NB), dx: F64(NB), dy: F64(NB),
    col: new Float32Array(NB * 3), buf: new Float32Array(N * 3), img: new Float32Array(N * 3),
    rim: new Float32Array(N), a: 0.3 * R, hue: 0, lastp: -1, tint: [0, 0, 0],
  };
  table(params.s);
  throwAll(params.s);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0.3, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = k[0] || 0;
  const v = VEL * cl(k[1] == null ? 2 : k[1], 0.2, 3), tr = cl(k[3] == null ? 0.06 : k[3], 0, 1);
  const tau = 0.05 + 1.5 * tr * tr * tr, f = exp(-d / tau), B = min(1, 0.09 / tau);
  hsv(P.hue + 0.57, 0.5, 1, P.tint, 0);

  // A new stem width squeezes or spreads the balls in the stem with it.
  const a = R * cl(k[2] == null ? 0.3 : k[2], 0.3, 0.9);
  if (abs(a - P.a) > 1e-6) {
    const s = a / P.a;
    for (let i = 0; i < NB; i++) if (P.y[i] < 0) P.x[i] *= s;
    P.a = a;
    table(P);
  }
  if (input.btnPressed && input.btnPressed[0]) throwAll(P);

  const buf = P.buf;
  for (let q = 0; q < N * 3; q++) buf[q] *= f;
  if (d > 0)
    for (let i = 0; i < NB; i++) {
      paint(P, i);
      P.lastp = -1;
      fly(P, i, v * d, B * f, B);
    }
  for (let q = 0; q < N * 3; q++) if (buf[q] > 1.2) buf[q] = 1.2;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const img = P.img, buf = P.buf, m = P.rim, t = P.tint;
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    img[q] = max(buf[q], t[0] * m[p]);
    img[q + 1] = max(buf[q + 1], t[1] * m[p]);
    img[q + 2] = max(buf[q + 2], t[2] * m[p]);
  }
  for (let i = 0; i < NB; i++) {
    paint(P, i);
    const q = (cl(floor(CY - P.y[i]), 0, H - 1) * W + cl(floor(CX + P.x[i]), 0, W - 1)) * 3, c = i * 3;
    img[q] = max(img[q], P.col[c]);
    img[q + 1] = max(img[q + 1], P.col[c + 1]);
    img[q + 2] = max(img[q + 2], P.col[c + 2]);
  }
  for (let p = 0, q = 0; p < N; p++, q += 3)
    display.setPixel(p % W, (p / W) | 0, round(cl(img[q], 0, 1) * 255), round(cl(img[q + 1], 0, 1) * 255), round(cl(img[q + 2], 0, 1) * 255));
}
