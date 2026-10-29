// ===== Patternflow pattern =====
// Title:   Hodograph
// Family:  physics
// Idea:    Bodies of different eccentricity circle one Sun in the upper half with Kepler's timing, each sweeping a fan of equal-time slices, and in the lower half each body's velocity, drawn from one common origin, runs round a circle set off from the origin by e times its radius.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: hodograph of motion under an inverse-square force (William Rowan Hamilton, 1846), Kepler's equation and the law of equal areas (Johannes Kepler, 1609), Feynman's lost lecture (Richard Feynman, 1964; David and Judith Goodstein, 1996), pattern round 66
// Round:   66
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Eccentricity=0.6..0.95, Bodies=3..6
//
// Knob 1: Hue. Turns the bodies' colours round the wheel together.
// Knob 2: Speed. How fast time runs.
// Knob 3: Eccentricity. The largest eccentricity.
// Knob 4: Bodies. How many bodies.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, sin, cos, atan2, PI, round, hypot } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (v) => v - TAU * floor(v / TAU);

// Upper half: the orbits round the Sun. Lower half: velocity space, every
// velocity drawn from one origin O. World y runs up in both. Each half is
// fitted to its own box, BOX LEDs square, centred on row MID[0] or MID[1].
const BOX = 59, MID = [31, 96];
// Apoapses run from Q0 to Q1 in world units, and an orbit with semi-major
// axis 20 takes T20 seconds at Speed 1. One Sun, so one mu for every body.
const Q0 = 13, Q1 = 29.5, T20 = 8;
const MU = (TAU / T20) ** 2 * 8000;
// Each body's fan covers this share of its period, in BANDS equal-time slices.
const FAN = 0.3, BANDS = 3;
// The arrow at a body is this share of the same velocity's length below.
const ARROW = 0.55;
// Equal steps of true anomaly marked on every orbit and hodograph.
const BEADS = 12;
const TAB = 1024;
// Body colours at Hue 0: cyan, magenta, green, azure, rose, yellow.
const HUES = [0.5, 0.83, 0.3, 0.64, 0.97, 0.14];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Kepler's equation M = E - e sin E by Newton's method; from pi it
// converges for every M in [0, 2 pi) and every e below 1.
function kepler(M, e) {
  let E = e > 0.8 ? PI : M;
  for (let k = 0; k < 40; k++) {
    const d = (E - e * sin(E) - M) / (1 - e * cos(E));
    E -= d;
    if (abs(d) < 1e-13) break;
  }
  return E;
}

// Mean anomaly at true anomaly th in [0, 2 pi], through the eccentric anomaly.
function meanAt(e, th) {
  const E = 2 * atan2(sqrt(1 - e) * sin(th / 2), sqrt(1 + e) * cos(th / 2));
  return E - e * sin(E);
}

// The claim, checked: velocities from Kepler's equation at 720 equal steps
// of time, a least-squares circle through them (Kasa's fit, which is not
// told the answer), the largest distance of a velocity from that circle as
// a share of its radius, and how far the circle's offset from the origin
// is from e times its radius.
function check() {
  let radial = 0, offset = 0;
  for (let e = 0; e < 0.96; e += 0.05) {
    const pts = [];
    for (let k = 0; k < 720; k++) {
      const E = kepler((TAU * k) / 720, e), q = 1 - e * cos(E);
      pts.push([-sin(E) / q, (sqrt(1 - e * e) * cos(E)) / q]);
    }
    let a = 0, b = 0, c = 0, d = 0, f = 0, n = pts.length, u = 0, v = 0, z = 0;
    for (const [x, y] of pts) {
      const r = x * x + y * y;
      a += x * x; b += x * y; c += y * y; d += x; f += y; u += x * r; v += y * r; z += r;
    }
    const det3 = (m) =>
      m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
    const A = [a, b, d, b, c, f, d, f, n], rhs = [-u, -v, -z], D = det3(A);
    const sol = [0, 1, 2].map((col) => det3(A.map((m, i) => (i % 3 === col ? rhs[floor(i / 3)] : m))) / D);
    const cx = -sol[0] / 2, cy = -sol[1] / 2, R = sqrt(cx * cx + cy * cy - sol[2]);
    for (const [x, y] of pts) radial = max(radial, abs(hypot(x - cx, y - cy) - R) / R);
    offset = max(offset, abs(hypot(cx, cy) / R - e));
  }
  return { radial, offset };
}

function body() {
  return {
    e: 0, a: 1, p: 1, Q: 1, nm: 1, R: 1, w: 0, cw: 1, sw: 0, M0: 0, M: 0,
    x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, hr: 1, mt: new Float64Array(TAB + 1), col: new Float32Array(3),
  };
}

export function setup(params) {
  params.s = {
    t: 0, n: 0, emax: -1, hue: 0,
    // Orbit scale and the Sun's LED; hodograph scale and the origin's LED.
    so: 1, fx: 31.5, fy: 31, hs: 1, ox: 31.5, oy: 96,
    b: [0, 1, 2, 3, 4, 5].map(body),
    rgb: new Float32Array(W * H * 3), c: new Float32Array(3),
    check: check(),
  };
  return params.s;
}

// Scale and centre that fit a world box into a half of the panel.
function fit(x0, x1, y0, y1, row) {
  const s = BOX / max(x1 - x0, y1 - y0);
  return [s, 31.5 - (s * (x0 + x1)) / 2, row + (s * (y0 + y1)) / 2];
}

// The bodies: eccentricities spread evenly up to the knob's, apoapses from
// Q0 to Q1, apse lines turned by the golden angle from one another. Then
// both halves are fitted: the orbits by their boxes, the hodographs by
// theirs, each circle of radius R = mu / h centred e R from O, square to
// the apse line.
function build(S, n, emax) {
  S.n = n;
  S.emax = emax;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (let i = 0; i < n; i++) {
    const B = S.b[i], e = (emax * (i + 1)) / n;
    B.e = e;
    B.Q = Q0 + ((Q1 - Q0) * i) / (n - 1);
    B.a = B.Q / (1 + e);
    B.p = B.a * (1 - e * e);
    B.nm = sqrt(MU / (B.a * B.a * B.a));
    B.R = sqrt(MU / B.p);
    B.w = 1.1 + i * 2.39996;
    B.cw = cos(B.w);
    B.sw = sin(B.w);
    B.M0 = 0.6 + i * 2.6;
    for (let k = 0; k <= TAB; k++) B.mt[k] = meanAt(e, (TAU * k) / TAB);
    const b = B.a * sqrt(1 - e * e), cx = -B.a * e * B.cw, cy = -B.a * e * B.sw;
    const ex = sqrt(B.a * B.a * B.cw * B.cw + b * b * B.sw * B.sw), ey = sqrt(B.a * B.a * B.sw * B.sw + b * b * B.cw * B.cw);
    x0 = min(x0, cx - ex); x1 = max(x1, cx + ex); y0 = min(y0, cy - ey); y1 = max(y1, cy + ey);
    const hx = -e * B.R * B.sw, hy = e * B.R * B.cw;
    u0 = min(u0, hx - B.R); u1 = max(u1, hx + B.R); v0 = min(v0, hy - B.R); v1 = max(v1, hy + B.R);
  }
  [S.so, S.fx, S.fy] = fit(x0, x1, y0, y1, MID[0]);
  [S.hs, S.ox, S.oy] = fit(u0, u1, v0, v1, MID[1]);
  for (let i = 0; i < n; i++) {
    const B = S.b[i];
    B.hr = B.R * S.hs;
    B.hx = -B.e * B.hr * B.sw;
    B.hy = B.e * B.hr * B.cw;
  }
}

function meanOf(B, th) {
  const f = (wrap(th) / TAU) * TAB, k = min(TAB - 1, floor(f));
  return B.mt[k] + (B.mt[k + 1] - B.mt[k]) * (f - k);
}

// Position (from the Sun) and velocity of a body at time t, by Kepler's
// equation, both in world axes.
function place(B, t) {
  const e = B.e, M = wrap(B.M0 + B.nm * t), E = kepler(M, e);
  const cE = cos(E), sE = sin(E), s1 = sqrt(1 - e * e), k = (B.nm * B.a) / (1 - e * cE);
  const px = B.a * (cE - e), py = B.a * s1 * sE, vx = -k * sE, vy = k * s1 * cE;
  B.M = M;
  B.x = px * B.cw - py * B.sw;
  B.y = px * B.sw + py * B.cw;
  B.vx = vx * B.cw - vy * B.sw;
  B.vy = vx * B.sw + vy * B.cw;
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  const speed = cl(kv[1], 0.2, 3), emax = cl(kv[2], 0.6, 0.95), n = cl(round(kv[3]), 3, 6);
  if (n !== S.n || emax !== S.emax) build(S, n, emax);
  S.t += d * speed;
  for (let i = 0; i < n; i++) {
    const B = S.b[i];
    place(B, S.t);
    hsv(S.hue + HUES[i], 0.8, 1, B.col);
  }
}

// Brightness of a fan at a given age, as a share of the fan's window:
// equal-time slices alternate bright and dim, fading toward the oldest.
function fan(age) {
  return (1 - age) ** 0.7 * (floor(age * BANDS) % 2 ? 0.26 : 0.5);
}

function put(rgb, x, y, c, v) {
  const o = (y * W + x) * 3;
  if (rgb[o] < c[0] * v) rgb[o] = c[0] * v;
  if (rgb[o + 1] < c[1] * v) rgb[o + 1] = c[1] * v;
  if (rgb[o + 2] < c[2] * v) rgb[o + 2] = c[2] * v;
}

// A soft point at panel coordinates (px, py), weights split over the four
// nearest LEDs, each keeping the brighter value.
function dot(rgb, px, py, c, v) {
  const x0 = floor(px), y0 = floor(py), fx = px - x0, fy = py - y0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const x = x0 + i, y = y0 + j;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      put(rgb, x, y, c, v * (i ? fx : 1 - fx) * (j ? fy : 1 - fy));
    }
}

function line(rgb, x0, y0, x1, y1, c, v) {
  const n = max(1, Math.ceil(hypot(x1 - x0, y1 - y0) * 2.2));
  for (let k = 0; k <= n; k++) dot(rgb, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, c, v);
}

function disc(rgb, px, py, rad, c, core) {
  for (let y = max(0, floor(py - rad - 1)); y <= min(H - 1, Math.ceil(py + rad + 1)); y++)
    for (let x = max(0, floor(px - rad - 1)); x <= min(W - 1, Math.ceil(px + rad + 1)); x++) {
      const d = hypot(x - px, y - py), v = cl(rad + 0.5 - d, 0, 1);
      if (v <= 0) continue;
      const w = core * cl(1 - d / rad, 0, 1), o = (y * W + x) * 3;
      rgb[o] = max(rgb[o], c[0] * v + (1 - c[0]) * w);
      rgb[o + 1] = max(rgb[o + 1], c[1] * v + (1 - c[1]) * w);
      rgb[o + 2] = max(rgb[o + 2], c[2] * v + (1 - c[2]) * w);
    }
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const rgb = S.rgb, n = S.n, bs = S.b, c = S.c, win = TAU * FAN;
  const so = S.so, fx = S.fx, fy = S.fy, hs = S.hs, ox = S.ox, oy = S.oy;
  rgb.fill(0);

  // The fans in the orbits: an LED's direction from the Sun is a true
  // anomaly on every orbit, the orbit's radius there says whether the LED is
  // inside, and the time since the body passed that direction picks the slice.
  for (let y = 0; y < 64; y++) {
    const dy = (fy - y) / so;
    for (let x = 0; x < W; x++) {
      const dx = (x - fx) / so, d = sqrt(dx * dx + dy * dy), phi = atan2(dy, dx);
      for (let i = 0; i < n; i++) {
        const B = bs[i];
        if (d > B.Q + 1) continue;
        const th = phi - B.w, edge = (B.p / (1 + B.e * cos(th)) - d) * so + 0.5;
        if (edge <= 0) continue;
        const age = wrap(B.M - meanOf(B, th)) / win;
        if (age >= 1) continue;
        put(rgb, x, y, B.col, fan(age) * min(1, edge));
      }
    }
  }
  // The same fans in velocity space: the ray from O through an LED meets
  // each hodograph at one velocity, whose angle round its circle's centre is
  // the true anomaly plus a quarter turn.
  for (let y = 64; y < H; y++) {
    const wy = oy - y;
    for (let x = 0; x < W; x++) {
      const wx = x - ox, d = sqrt(wx * wx + wy * wy);
      if (d < 1e-6) continue;
      const ux = wx / d, uy = wy / d;
      for (let i = 0; i < n; i++) {
        const B = bs[i], ex = wx - B.hx, ey = wy - B.hy, edge = B.hr + 0.5 - sqrt(ex * ex + ey * ey);
        if (edge <= 0) continue;
        const uc = ux * B.hx + uy * B.hy;
        const s = uc + sqrt(max(0, uc * uc - B.hx * B.hx - B.hy * B.hy + B.hr * B.hr));
        const th = atan2(s * uy - B.hy, s * ux - B.hx) - B.w - PI / 2;
        const age = wrap(B.M - meanOf(B, th)) / win;
        if (age >= 1) continue;
        put(rgb, x, y, B.col, fan(age) * min(1, edge));
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const B = bs[i], e = B.e, s1 = sqrt(1 - e * e), A = B.a * so;
    // The orbit, brighter where the body has just been.
    for (let k = 0; k < 420; k++) {
      const E = (TAU * k) / 420, px = A * (cos(E) - e), py = A * s1 * sin(E);
      const age = wrap(B.M - (E - e * sin(E))) / win;
      dot(rgb, fx + px * B.cw - py * B.sw, fy - (px * B.sw + py * B.cw), B.col, age < 1 ? 0.95 - 0.5 * age : 0.4);
    }
    // The hodograph, the same way.
    const nh = max(90, round(B.hr * 9));
    for (let k = 0; k < nh; k++) {
      const th = (TAU * k) / nh, vx = -B.hr * sin(th), vy = B.hr * (e + cos(th));
      const age = wrap(B.M - meanAt(e, th)) / win;
      dot(rgb, ox + vx * B.cw - vy * B.sw, oy - (vx * B.sw + vy * B.cw), B.col, age < 1 ? 0.95 - 0.5 * age : 0.4);
    }
    // The circle's centre, e times its radius from O.
    dot(rgb, ox + B.hx, oy - B.hy, B.col, 0.6);
    // Feynman's beads: the orbit at equal steps of angle round the Sun, and
    // the velocities there, which fall at equal steps round the circle.
    for (let k = 0; k < 3; k++) c[k] = 0.55 + 0.45 * B.col[k];
    for (let k = 0; k < BEADS; k++) {
      const th = (TAU * k) / BEADS, r = (B.p * so) / (1 + e * cos(th));
      const px = r * cos(th), py = r * sin(th), vx = -B.hr * sin(th), vy = B.hr * (e + cos(th));
      dot(rgb, fx + px * B.cw - py * B.sw, fy - (px * B.sw + py * B.cw), c, 1);
      dot(rgb, ox + vx * B.cw - vy * B.sw, oy - (vx * B.sw + vy * B.cw), c, 1);
    }
  }
  for (let i = 0; i < n; i++) {
    const B = bs[i], col = B.col;
    for (let k = 0; k < 3; k++) c[k] = 0.5 + 0.5 * col[k];
    const bx = fx + B.x * so, by = fy - B.y * so, tx = ox + B.vx * hs, ty = oy - B.vy * hs;
    // A thread from the body to the tip of its velocity, the velocity arrow
    // at the body, and the same velocity from O.
    line(rgb, bx, by, tx, ty, col, 0.16);
    line(rgb, bx, by, bx + (tx - ox) * ARROW, by + (ty - oy) * ARROW, c, 1);
    line(rgb, ox, oy, tx, ty, c, 1);
    disc(rgb, tx, ty, 1.2, col, 0.6);
    disc(rgb, bx, by, 1.5, col, 0.8);
  }
  c[0] = 1; c[1] = 0.86; c[2] = 0.6;
  disc(rgb, fx, fy, 1.8, c, 1);
  c[0] = c[1] = c[2] = 1;
  disc(rgb, ox, oy, 0.9, c, 1);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      display.setPixel(x, y, min(255, rgb[o] * 255) | 0, min(255, rgb[o + 1] * 255) | 0, min(255, rgb[o + 2] * 255) | 0);
    }
}
