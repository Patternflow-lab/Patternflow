// ===== Patternflow pattern =====
// Title:   Belt Trick
// Family:  topology
// Idea:    A cube in the middle of the panel, tied by ribbons to bars along the top and bottom edges, turns about one axis without stopping: after one full turn the ribbons are wound round it and no moving of the ribbons alone can free them, after the second they have swung round the cube and hang straight again, and a ring behind it fills once a turn, violet in the first and green in the second, so the two turns can be told apart.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Dirac's string problem (Paul Dirac; M. H. A. Newman, 1942), the double cover of SO(3) by the unit quaternions, pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Ribbons=2..8, Tilt=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the ribbons are amber on the front and cyan on the back, the cube's faces blue, violet and pink, and the ring violet in the first turn and green in the second.
// Knob 2: Speed. At 2 the cube turns once in 4 seconds, so the ribbons come free every 8; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Ribbons. How many ribbons tie the cube, from 2, one belt up and one down, to 8, four each way. Fewer ribbons are wider. Neighbours also sit 4 apart in depth: over a whole loop no two ribbons come closer than 0.6 LEDs with 8 of them, 0.8 with 4 and 4.8 with 2.
// Knob 4: Tilt. The spin axis. At 0 it stands upright and the cube turns like a plate on a waiter's hand, and after one turn the ribbons lie wound round it in the plane of the panel; at 1 it points at us, the cube turns like a wheel, and after one turn the ribbons are twisted round each other like a rope.
// Buttons: K1 tap reverses the spin.

const W = 64, H = 128, N = W * H;
const { min, max, floor, ceil, sqrt, sin, cos, abs, atan2, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The cube's half side, the ball it turns in, the shell the ribbons move in,
// and the wall the ribbons are tied to, just past the panel's top and bottom.
const HC = 8, RIN = HC * sqrt(3) + 1.2, ROUT = 30.5, YW = 67;
// Rows of a ribbon inside the shell.
const NS = 110;
// Camera: turned a little to the right and looking a little down.
const DIST = 170, YAW = 0.42, PITCH = 0.16, CX = 31.5, CY = 63.5;
const CYW = cos(YAW), SYW = sin(YAW), CP = cos(PITCH), SP = sin(PITCH);

function hsv(h, s, v) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [
    i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p,
    i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p,
    i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p,
  ];
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  params.s = {
    t: 0, dir: 1, hue: 0, sp: 2, n: 2, tilt: 0.06,
    zb: F(N), id: new Int16Array(N), col: F(N * 3),
    // Mapped ribbon vertices (world) and their screen places.
    wx: F(2 * NS + 8), wy: F(2 * NS + 8), wz: F(2 * NS + 8), sx: F(2 * NS + 8), sy: F(2 * NS + 8), sz: F(2 * NS + 8),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 2, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  s.sp = cl(k[1], 0.2, 3);
  s.n = cl(Math.round(k[2]), 2, 8);
  s.tilt = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) s.dir = -s.dir;
  // t runs 0..1 over the two turns, 720 degrees.
  s.t += (s.dir * d * s.sp) / 16;
  s.t -= floor(s.t);
}

// The homotopy. q(t) = cos(2 pi t) + sin(2 pi t) a is the cube's turn by
// 720 degrees about the unit axis a, a loop in the unit quaternions. With
// b = s pi / 2 and v a unit vector at right angles to a,
//   H(s, t) = (cos^2 b + sin^2 b cos 2 pi t) + (sin b sin 2 pi t) a + (cos b sin b (1 - cos 2 pi t)) v.
// For each s, t runs H round a circle in the 3-sphere that passes through 1
// and touches the loop there; the circles shrink from the loop itself at
// s = 1 to the point 1 at s = 0. H has length 1, H(0, t) = 1, H(1, t) = q(t)
// and H(s, 0) = H(s, 1) = 1. At t = 1/2 it is a turn by 360 s degrees about
// v: the ribbons wound once round the cube. s is read off the distance from
// the cube's centre, 0 at the shell's outer sphere and 1 at its inner one,
// so every sphere round the cube turns as one piece and nothing in space
// ever passes through anything else.
function shellTurn(x, y, z, ax, ay, az, vx, vy, vz, C, S, out, o) {
  const r = sqrt(x * x + y * y + z * z);
  let u = cl((ROUT - r) / (ROUT - RIN), 0, 1);
  u = u * u * (3 - 2 * u);
  const b = (u * PI) / 2, cb = cos(b), sb = sin(b);
  const w = cb * cb + sb * sb * C, p = sb * S, q = cb * sb * (1 - C);
  rot(w, p * ax + q * vx, p * ay + q * vy, p * az + q * vz, x, y, z, out, o);
}

// Turn (x, y, z) by the unit quaternion w + (i, j, k).
function rot(w, i, j, k, x, y, z, out, o) {
  const tx = 2 * (j * z - k * y), ty = 2 * (k * x - i * z), tz = 2 * (i * y - j * x);
  out[o] = x + w * tx + (j * tz - k * ty);
  out[o + 1] = y + w * ty + (k * tx - i * tz);
  out[o + 2] = z + w * tz + (i * ty - j * tx);
}

// World to screen: the camera turns the world, then a soft perspective.
function cam(x, y, z, out, o) {
  const x1 = x * CYW - z * SYW, z1 = x * SYW + z * CYW;
  const y2 = y * CP - z1 * SP, z2 = y * SP + z1 * CP;
  const f = DIST / (DIST - z2);
  out[o] = CX + x1 * f;
  out[o + 1] = CY - y2 * f;
  out[o + 2] = DIST - z2;
}

const tmp = new Float32Array(3), hc = new Float32Array(3 * (NS + 3));
// How much a normal faces the eye.
const toEye = (x, y, z) => y * SP + (x * SYW + z * CYW) * CP;

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const { zb, id, col, wx, wy, wz, sx, sy, sz } = s;
  zb.fill(1e9);
  id.fill(0);
  const al = ((1 - s.tilt) * PI) / 2;
  const ax = 0, ay = sin(al), az = cos(al), vx = 0, vy = cos(al), vz = -sin(al);
  const C = cos(TAU * s.t), S = sin(TAU * s.t);
  const L = [0.42, 0.55, 0.72];
  const h0 = s.hue;
  const fr = hsv(h0 + 0.1, 0.85, 1), bk = hsv(h0 + 0.5, 0.75, 1);
  const n = s.n, nt = ceil(n / 2);
  let rib = 0;
  for (let side = 0; side < 2; side++) {
    const k = side ? n - nt : nt, sg = side ? -1 : 1;
    const spc = (1.75 * HC) / k, wdt = min(8.5, 0.5 * spc), spw = 46 / k;
    for (let r = 0; r < k; r++, rib++) {
      // Neighbours sit 4 apart in depth as well, which keeps them about
      // twice as far apart when they are wound round the cube.
      const zs = k > 1 ? ((r + side) & 1 ? 2 : -2) : 0;
      const off = r - (k - 1) / 2;
      const Ax = off * spw, Ay = sg * YW, Bx = off * spc, By = sg * HC;
      const dx = Bx - Ax, dy = By - Ay, len = sqrt(dx * dx + dy * dy);
      // Across the ribbon, in the panel's plane.
      const bx = (dy / len) * sg, by = (-dx / len) * sg;
      // Where the centre line crosses the shell's spheres.
      const uo = cross(Ax, Ay, dx, dy, sqrt((ROUT + 1) ** 2 - zs * zs)), ui = cross(Ax, Ay, dx, dy, sqrt((RIN - 0.5) ** 2 - zs * zs));
      const rows = NS + 3;
      for (let j = 0; j < rows; j++) {
        const u = j === 0 ? 0 : j === rows - 1 ? 1 : uo + ((ui - uo) * (j - 1)) / NS;
        const cxp = Ax + dx * u, cyp = Ay + dy * u;
        for (let e = 0; e < 2; e++) {
          const h = (e ? 0.5 : -0.5) * wdt, vi = j * 2 + e;
          shellTurn(cxp + bx * h, cyp + by * h, zs, ax, ay, az, vx, vy, vz, C, S, tmp, 0);
          wx[vi] = tmp[0];
          wy[vi] = tmp[1];
          wz[vi] = tmp[2];
          cam(tmp[0], tmp[1], tmp[2], tmp, 0);
          sx[vi] = tmp[0];
          sy[vi] = tmp[1];
          sz[vi] = tmp[2];
        }
      }
      for (let j = 0; j < rows - 1; j++) {
        const a = j * 2, b = a + 1, c = a + 2, dd = a + 3;
        // The face's normal in the world, for the light.
        const ux = wx[c] - wx[a], uy = wy[c] - wy[a], uz = wz[c] - wz[a];
        const qx = wx[b] - wx[a], qy = wy[b] - wy[a], qz = wz[b] - wz[a];
        let nx = uy * qz - uz * qy, ny = uz * qx - ux * qz, nz = ux * qy - uy * qx;
        const nl = 1 / (sqrt(nx * nx + ny * ny + nz * nz) + 1e-9);
        nx *= nl;
        ny *= nl;
        nz *= nl;
        // Which face is towards us: the sign of the quad's area on the screen.
        const area = (sx[a] - sx[dd]) * (sy[b] - sy[c]) - (sx[b] - sx[c]) * (sy[a] - sy[dd]);
        const front = area * sg < 0;
        tri(s, a, c, b, rib + 1, nx, ny, nz, front ? fr : bk, L);
        tri(s, b, c, dd, rib + 1, nx, ny, nz, front ? fr : bk, L);
        hc[j * 3] = s.lr * 0.8;
        hc[j * 3 + 1] = s.lg * 0.8;
        hc[j * 3 + 2] = s.lb * 0.8;
      }
      // The hems, drawn as lines, so a ribbon seen edge on stays a line.
      for (let j = 0; j < rows - 1; j++)
        for (let e = 0; e < 2; e++) {
          const a = j * 2 + e, b = a + 2;
          line(s, sx[a], sy[a], sz[a], sx[b], sy[b], sz[b], rib + 1, hc[j * 3], hc[j * 3 + 1], hc[j * 3 + 2]);
        }
    }
  }
  cube(s, ax, ay, az, C, S, L);
  shade(s, display);
}

// The u where the line (Ax, Ay) + u (dx, dy) is at distance R from the centre.
function cross(Ax, Ay, dx, dy, R) {
  const a = dx * dx + dy * dy, b = 2 * (Ax * dx + Ay * dy), c = Ax * Ax + Ay * Ay - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return 1;
  return cl((-b - sqrt(disc)) / (2 * a), 0, 1);
}

function tri(s, i0, i1, i2, idv, nx, ny, nz, c, L) {
  const { sx, sy, sz } = s;
  const x0 = sx[i0], y0 = sy[i0], x1 = sx[i1], y1 = sy[i1], x2 = sx[i2], y2 = sy[i2];
  // Two-sided light: the normal is turned to face the eye.
  const sgn = toEye(nx, ny, nz) >= 0 ? 1 : -1;
  const ld = max(0, sgn * (nx * L[0] + ny * L[1] + nz * L[2]));
  const lit = 0.6 + 0.4 * ld;
  const r = c[0] * lit, g = c[1] * lit, b = c[2] * lit;
  (s.lr = r), (s.lg = g), (s.lb = b);
  fill(s, x0, y0, x1, y1, x2, y2, sz[i0], sz[i1], sz[i2], idv, r, g, b);
}

function line(s, x0, y0, z0, x1, y1, z1, idv, r, g, b) {
  const { zb, id, col } = s;
  const n = ceil(max(abs(x1 - x0), abs(y1 - y0)) * 1.5) + 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = floor(x0 + (x1 - x0) * u), y = floor(y0 + (y1 - y0) * u);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    const q = y * W + x, d = z0 + (z1 - z0) * u - 0.9;
    if (d < zb[q]) {
      zb[q] = d + 0.9;
      id[q] = idv;
      col[q * 3] = r;
      col[q * 3 + 1] = g;
      col[q * 3 + 2] = b;
    }
  }
}

function fill(s, x0, y0, x1, y1, x2, y2, z0, z1, z2, idv, r, g, b) {
  const { zb, id, col } = s;
  const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (abs(den) < 1e-9) return;
  const inv = 1 / den;
  const X0 = max(0, ceil(min(x0, x1, x2) - 0.5)), X1 = min(W - 1, floor(max(x0, x1, x2) - 0.5));
  const Y0 = max(0, ceil(min(y0, y1, y2) - 0.5)), Y1 = min(H - 1, floor(max(y0, y1, y2) - 0.5));
  for (let y = Y0; y <= Y1; y++) {
    const cy = y + 0.5 - y0;
    for (let x = X0; x <= X1; x++) {
      const cx = x + 0.5 - x0;
      const a = (cx * (y2 - y0) - cy * (x2 - x0)) * inv, bb = ((x1 - x0) * cy - (y1 - y0) * cx) * inv;
      if (a < -1e-6 || bb < -1e-6 || a + bb > 1 + 1e-6) continue;
      const d = z0 + (z1 - z0) * a + (z2 - z0) * bb, q = y * W + x;
      if (d < zb[q]) {
        zb[q] = d;
        id[q] = idv;
        col[q * 3] = r;
        col[q * 3 + 1] = g;
        col[q * 3 + 2] = b;
      }
    }
  }
}

// The cube: six faces, each its own colour, turned by q(t).
const FACES = [
  [1, 0, 0, 0, 1, 0, 0, 0, 1], [-1, 0, 0, 0, 1, 0, 0, 0, -1],
  [0, 1, 0, 0, 0, 1, 1, 0, 0], [0, -1, 0, 0, 0, -1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 1, 0], [0, 0, -1, -1, 0, 0, 0, 1, 0],
];
const cv = new Float32Array(12), cn = new Float32Array(3);
function cube(s, ax, ay, az, C, S, L) {
  const w = C, i = S * ax, j = S * ay, k = S * az;
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    rot(w, i, j, k, F[0], F[1], F[2], cn, 0);
    const vdot = toEye(cn[0], cn[1], cn[2]);
    const ld = max(0, cn[0] * L[0] + cn[1] * L[1] + cn[2] * L[2]);
    const c = hsv(s.hue + 0.62 + 0.13 * (f >> 1), f & 1 ? 0.4 : 0.8, 1);
    const lit = 0.5 + 0.5 * ld;
    for (let q = 0; q < 4; q++) {
      const e = q === 0 || q === 3 ? -1 : 1, g = q < 2 ? -1 : 1;
      const x = (F[0] + e * F[3] + g * F[6]) * HC, y = (F[1] + e * F[4] + g * F[7]) * HC, z = (F[2] + e * F[5] + g * F[8]) * HC;
      rot(w, i, j, k, x, y, z, tmp, 0);
      cam(tmp[0], tmp[1], tmp[2], cv, q * 3);
    }
    if (vdot < -0.05) continue;
    const r = c[0] * lit, gg = c[1] * lit, b = c[2] * lit;
    fill(s, cv[0], cv[1], cv[3], cv[4], cv[6], cv[7], cv[2], cv[5], cv[8], 20 + f, r, gg, b);
    fill(s, cv[0], cv[1], cv[6], cv[7], cv[9], cv[10], cv[2], cv[8], cv[11], 20 + f, r, gg, b);
  }
}

function shade(s, display) {
  const { id, col } = s;
  const lap = s.t < 0.5 ? 0 : 1, prog = (s.t * 2) % 1;
  const ca = hsv(s.hue + 0.78, 0.65, 0.7), cb = hsv(s.hue + 0.36, 0.75, 0.7);
  const cur = lap ? cb : ca, old = lap ? ca : cb;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, o = q * 3, p = id[q];
      // The bars the ribbons are tied to, along the top and bottom edges,
      // with a clamp where a ribbon goes under.
      if (y < 2 || y > H - 3) {
        const edge = y === 1 || y === H - 2, tied = edge && id[y === 1 ? q + W : q - W] > 0 && id[y === 1 ? q + W : q - W] < 20;
        const v = tied ? 170 : edge ? 70 : 40;
        display.setPixel(x, y, v * 0.85, v * 0.78, v);
        continue;
      }
      if (p) {
        // A seam where two ribbons or two faces meet.
        const rp = x < W - 1 ? id[q + 1] : p, dp = y < H - 1 ? id[q + W] : p;
        const k = (rp && rp !== p) || (dp && dp !== p) ? 150 : 255;
        display.setPixel(x, y, min(255, col[o] * k), min(255, col[o + 1] * k), min(255, col[o + 2] * k));
        continue;
      }
      // The dial behind the cube: one colour fills it in the first turn,
      // the other in the second.
      const dx = x + 0.5 - CX, dy = y + 0.5 - CY, r = sqrt(dx * dx + dy * dy);
      const ring = cl(1.6 - abs(r - ROUT - 0.6), 0, 1);
      if (ring > 0) {
        let a = atan2(dx, -dy) / TAU;
        if (a < 0) a += 1;
        const c = a < prog ? cur : old, m = a < prog ? 1 : 0.4;
        const tip = abs(a - prog) < 0.012 || abs(a - prog) > 0.988 ? 1.6 : 1;
        display.setPixel(x, y, c[0] * 255 * ring * m * tip, c[1] * 255 * ring * m * tip, c[2] * 255 * ring * m * tip);
      } else display.setPixel(x, y, 4, 3, 10);
    }
}
