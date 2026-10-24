// ===== Patternflow pattern =====
// Title:   Stadium Billiard
// Family:  physics
// Idea:    Two hundred balls leave one spot as a single white bead, their headings three thousandths of a radian apart, and the round ends of a Bunimovich stadium the size of the panel stretch the bead into a rainbow line and fold it until the balls fill the table as a gas.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the Bunimovich stadium (Leonid Bunimovich, 1974), pattern round 28
// Round:   28
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Round=0..1, Trail=0..1
//
// Knob 1: Hue. Each ball's colour is its place in the fan, from yellow-green at one edge through cyan to violet at the other at 0; turning it takes that rainbow round the wheel, and the faint cloth from teal to violet and back.
// Knob 2: Speed. At 2 a ball flies 125 LEDs a second, about the panel's height: the bead holds together for two seconds, is a rainbow line at three and a gas by seven. At 0.2 it is 12.5 LEDs a second and the gas is a drift of single dots.
// Knob 3: Round. At 0 the straight sides are 64 LEDs long and the table is the whole panel, half circles of radius 32 touching the top and bottom rows; turning it shortens them, and at 1 the table is a circle in the middle 64 rows. A circle is integrable: a bunch launched there is still a bead when the next one leaves, and its chords never come inside a ring round the centre, which shows as a hole once Trail is up.
// Knob 4: Trail. How long a path stays lit. At 0.06 a ball draws a streak of about 12 LEDs; at 1 a path takes two seconds to fade and the paths add up to a haze with the bright dots running through it.
// Buttons: K1 tap sends every ball straight to a new spot in under a second and a fresh bunch leaves it. The gas also gathers by itself after 1900 LEDs of flight, fifteen seconds at the opening speed.

const W = 64, H = 128, N = W * H, CX = 32, CY = 64, R = 32;
const { min, max, floor, ceil, sqrt, exp, cos, sin, abs, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Two hundred balls, launched with headings spread over FAN radians. VEL
// LEDs a second per unit of Speed; TAU the shortest trail's time constant.
// After CYCLE LEDs of flight the gas gathers for GATHER seconds and a new
// bunch leaves. The cloth and its edge sit just under the 24/255 an LED
// needs to count as lit, so the table shows on the panel as a faint shape.
const NB = 200;
const FAN = 3e-3, VEL = 62.5, TAU = 0.035;
const CYCLE = 1900, GATHER = 0.9;
const CLOTH = 0.075, RIM = 0.094;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const r = [v, q, p, p, t, v][i], g = [t, v, v, q, p, p][i], b = [p, p, t, v, v, q][i];
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
}

function inside(a, x, y, m) {
  if (abs(y) <= a) return abs(x) <= R - m;
  const cy = y > 0 ? a : -a;
  return x * x + (y - cy) * (y - cy) <= (R - m) * (R - m);
}

// Where along (dx, dy) a ball at (x, y) meets the wall, and the wall's
// normal there.
const HIT = [0, 0, 0];
function hit(a, x, y, dx, dy) {
  let t = Infinity, nx = 0, ny = 0;
  if (dx > 1e-12) {
    const u = (R - x) / dx;
    if (u > 1e-9 && abs(y + u * dy) <= a) (t = u), (nx = 1), (ny = 0);
  } else if (dx < -1e-12) {
    const u = (-R - x) / dx;
    if (u > 1e-9 && abs(y + u * dy) <= a) (t = u), (nx = -1), (ny = 0);
  }
  for (let s = -1; s <= 1; s += 2) {
    const cy = s * a, py = y - cy, b = x * dx + py * dy, c = x * x + py * py - R * R, d = b * b - c;
    if (d < 0) continue;
    const u = -b + sqrt(d);
    if (u <= 1e-9 || u >= t) continue;
    const hy = y + u * dy - cy;
    if (s * hy < -1e-6) continue;
    t = u;
    nx = (x + u * dx) / R;
    ny = hy / R;
  }
  HIT[0] = t;
  HIT[1] = nx;
  HIT[2] = ny;
}

// Lights the LEDs a ball passes between (x0, y0) and (x1, y1), each once,
// w0 at the start fading up to w1 at the end.
function trail(P, i, x0, y0, x1, y1, w0, w1) {
  const n = max(1, ceil(sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0)) / 0.6)), buf = P.buf, c = i * 3;
  const cr = P.col[c], cg = P.col[c + 1], cb = P.col[c + 2];
  for (let j = 1; j <= n; j++) {
    const t = j / n, X = floor(x0 + (x1 - x0) * t + CX), Y = floor(y0 + (y1 - y0) * t + CY);
    const p = cl(Y, 0, H - 1) * W + cl(X, 0, W - 1);
    if (p === P.lastp) continue;
    P.lastp = p;
    const w = w0 + (w1 - w0) * t, q = p * 3;
    buf[q] += cr * w;
    buf[q + 1] += cg * w;
    buf[q + 2] += cb * w;
  }
}

// Ball i flies s LEDs, bouncing off the walls exactly.
function fly(P, i, s, w0, w1) {
  const a = P.a;
  let x = P.x[i], y = P.y[i], dx = P.dx[i], dy = P.dy[i], done = 0;
  for (let k = 0; k < 24 && done < s; k++) {
    hit(a, x, y, dx, dy);
    // Every ray from inside meets the wall; a ball that finds none has been
    // left outside, and goes back to the middle.
    if (HIT[0] === Infinity && !inside(a, x, y, -0.5)) (x = 0), (y = 0);
    const bounce = HIT[0] < s - done, t = bounce ? HIT[0] : s - done;
    const x1 = x + t * dx, y1 = y + t * dy;
    trail(P, i, x, y, x1, y1, w0 + ((w1 - w0) * done) / s, w0 + ((w1 - w0) * (done + t)) / s);
    x = x1;
    y = y1;
    done = bounce ? done + t : s;
    if (bounce) {
      const nx = HIT[1], ny = HIT[2], d = dx * nx + dy * ny;
      dx -= 2 * d * nx;
      dy -= 2 * d * ny;
    }
  }
  P.x[i] = x;
  P.y[i] = y;
  P.dx[i] = dx;
  P.dy[i] = dy;
}

// How far apart the two edge balls of a bunch launched from (x, y) at
// angle th are after flying s LEDs.
function split(a, x, y, th, s) {
  const e = [];
  for (const o of [-FAN / 2, FAN / 2]) {
    let px = x, py = y, dx = cos(th + o), dy = sin(th + o), done = 0;
    for (let k = 0; k < 200 && done < s; k++) {
      hit(a, px, py, dx, dy);
      if (HIT[0] >= s - done) {
        px += (s - done) * dx;
        py += (s - done) * dy;
        break;
      }
      px += HIT[0] * dx;
      py += HIT[0] * dy;
      done += HIT[0];
      const d = dx * HIT[1] + dy * HIT[2];
      dx -= 2 * d * HIT[1];
      dy -= 2 * d * HIT[2];
    }
    e.push(px, py);
  }
  return sqrt((e[0] - e[2]) ** 2 + (e[1] - e[3]) ** 2);
}

// A new launch: of sixteen spots and headings, the one whose bunch holds
// together for the first 250 LEDs of flight and is furthest apart after 400
// and 550, two and three and a half seconds at the opening speed. Headings
// stay at least 30 degrees off the bouncing-ball orbits that run straight
// across between the flat sides and take their time to come apart.
function pick(P) {
  const a = P.a;
  let best = [0, 0, PI / 3], bd = -2;
  for (let k = 0; k < 16; k++) {
    const x = (Math.random() * 2 - 1) * 20, y = (Math.random() * 2 - 1) * (a + 16);
    if (!inside(a, x, y, 6)) continue;
    let th = (0.17 + Math.random() * 0.3) * PI;
    if (Math.random() < 0.5) th = -th;
    if (Math.random() < 0.5) th = PI - th;
    const d = a < 4 ? 0 : split(a, x, y, th, 250) < 6 ? split(a, x, y, th, 400) + split(a, x, y, th, 550) : -1;
    if (d > bd) (bd = d), (best = [x, y, th]);
  }
  return best;
}

function launch(P, x, y, th) {
  if (!inside(P.a, x, y, 1)) (x = 0), (y = 0);
  for (let i = 0; i < NB; i++) {
    const t = th + FAN * (i / (NB - 1) - 0.5);
    P.x[i] = x;
    P.y[i] = y;
    P.dx[i] = cos(t);
    P.dy[i] = sin(t);
  }
  P.run = 0;
  P.g = -1;
}

// The cloth: 1 on the table, 2 on its edge, 0 in the corners outside it.
function table(P) {
  const a = P.a, m = P.cloth;
  for (let p = 0; p < N; p++) m[p] = inside(a, (p % W) + 0.5 - CX, ((p / W) | 0) + 0.5 - CY, 0) ? 1 : 0;
  const put = (x, y) => (m[cl(floor(y + CY), 0, H - 1) * W + cl(floor(x + CX), 0, W - 1)] = 2);
  for (let y = -a; y <= a; y += 0.5) put(-R + 0.01, y), put(R - 0.01, y);
  for (let k = 0; k <= 400; k++) {
    const t = (k / 400) * PI, x = R * cos(t) * 0.9997, y = R * sin(t) * 0.9997;
    put(x, a + y);
    put(x, -a - y);
  }
}

export function setup(params) {
  const F64 = (n) => new Float64Array(n);
  params.s = {
    x: F64(NB), y: F64(NB), dx: F64(NB), dy: F64(NB), gx: F64(NB), gy: F64(NB),
    col: new Float32Array(NB * 3), buf: new Float32Array(N * 3), img: new Float32Array(N * 3),
    a: 32, cloth: new Uint8Array(N), run: 0, g: -1, L: null, lastp: -1, hue: NaN, tint: [0, 0, 0, 0, 0, 0],
  };
  table(params.s);
  launch(params.s, -19.9, 11.2, 2.389);
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  const v = VEL * cl(k[1], 0.2, 3), tr = cl(k[3], 0, 1), tau = TAU + 2.2 * tr * tr;
  const f = exp(-d / tau), B = min(1, 0.07 / tau);
  // Each ball keeps its place in the fan as a colour, six tenths of the
  // wheel from one edge to the other, so the bead is white where they all
  // overlap and the line it stretches into is a rainbow. The cloth turns
  // from teal to violet and back and is never a dim orange, which reads brown.
  if (k[0] !== P.hue) {
    P.hue = k[0];
    for (let i = 0; i < NB; i++) hsv(k[0] + 0.5 + 0.6 * (i / (NB - 1) - 0.5), 1, 1, P.col, i * 3);
    const c = 0.52 + 0.28 * sin(PI * k[0]) ** 2;
    hsv(c, 0.75, CLOTH, P.tint, 0);
    hsv(c, 0.6, RIM, P.tint, 3);
  }

  // The table: two half circles of radius 32 joined by straight sides 2a long.
  const a = 32 * (1 - cl(k[2], 0, 1));
  if (abs(a - P.a) > 1e-6) {
    P.a = a;
    table(P);
    for (let i = 0; i < NB; i++) {
      let x = P.x[i], y = P.y[i];
      if (inside(a, x, y, 0.01)) continue;
      const cy = abs(y) <= a ? y : y > 0 ? a : -a, ox = x, oy = y - cy, r = sqrt(ox * ox + oy * oy) || 1;
      x = (ox / r) * (R - 0.02);
      y = cy + (oy / r) * (R - 0.02);
      const nx = ox / r, ny = oy / r, dd = P.dx[i] * nx + P.dy[i] * ny;
      if (dd > 0) (P.dx[i] -= 2 * dd * nx), (P.dy[i] -= 2 * dd * ny);
      P.x[i] = x;
      P.y[i] = y;
    }
  }

  const buf = P.buf;
  for (let q = 0; q < N * 3; q++) buf[q] *= f;
  if (P.g >= 0 && !inside(a, P.L[0], P.L[1], 1)) (P.L[0] = 0), (P.L[1] = 0);

  if (P.g < 0 && ((input.btnPressed && input.btnPressed[0]) || P.run > CYCLE)) {
    P.L = pick(P);
    P.g = 0;
    P.gx.set(P.x);
    P.gy.set(P.y);
  }
  if (P.g >= 0) {
    // Gathering: every ball runs straight to the next launch spot.
    const u0 = P.g / GATHER, u1 = min(1, (P.g + d) / GATHER);
    const e0 = u0 * u0 * (3 - 2 * u0), e1 = u1 * u1 * (3 - 2 * u1), [lx, ly, th] = P.L;
    for (let i = 0; i < NB; i++) {
      const x0 = P.gx[i] + (lx - P.gx[i]) * e0, y0 = P.gy[i] + (ly - P.gy[i]) * e0;
      const x1 = P.gx[i] + (lx - P.gx[i]) * e1, y1 = P.gy[i] + (ly - P.gy[i]) * e1;
      P.lastp = -1;
      trail(P, i, x0, y0, x1, y1, B * f, B);
      P.x[i] = x1;
      P.y[i] = y1;
    }
    P.g += d;
    if (u1 >= 1) launch(P, lx, ly, th);
  } else if (d > 0) {
    const s = v * d;
    for (let i = 0; i < NB; i++) {
      P.lastp = -1;
      fly(P, i, s, B * f, B);
    }
    P.run += s;
  }
  // Where the whole bunch passes at once the light piles up; capped, the
  // bead's tail is no longer than a lone ball's.
  for (let q = 0; q < N * 3; q++) if (buf[q] > 1.5) buf[q] = 1.5;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const img = P.img, col = P.col, t = P.tint, m = P.cloth, buf = P.buf;
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    const o = m[p] === 2 ? 3 : 0, c = m[p] ? 1 : 0;
    img[q] = max(buf[q], t[o] * c);
    img[q + 1] = max(buf[q + 1], t[o + 1] * c);
    img[q + 2] = max(buf[q + 2], t[o + 2] * c);
  }
  for (let i = 0; i < NB; i++) {
    const q = (cl(floor(P.y[i] + CY), 0, H - 1) * W + cl(floor(P.x[i] + CX), 0, W - 1)) * 3, c = i * 3;
    img[q] += col[c];
    img[q + 1] += col[c + 1];
    img[q + 2] += col[c + 2];
  }
  for (let p = 0, q = 0; p < N; p++, q += 3) {
    display.setPixel(p % W, (p / W) | 0, min(255, img[q] * 255) | 0, min(255, img[q + 1] * 255) | 0, min(255, img[q + 2] * 255) | 0);
  }
}
