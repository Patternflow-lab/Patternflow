// ===== Patternflow pattern =====
// Title:   Catenoid-Helicoid
// Family:  space
// Idea:    A helicoid stands up the panel and turns about its axis while it unwinds into a catenoid and winds up again the other way, a checkerboard painted on it in (u, v) keeping every square the same size and shape the whole time, because the bending stretches nothing.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the catenoid (Leonhard Euler, 1744) bent into the helicoid (Jean Baptiste Meusnier, 1776) without stretching (Edmond Bour, 1862), pattern round 53
// Round:   53
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Squares=12..36, Tilt=0..1
//
// Knob 1: Hue. Turns both faces round the wheel together: at 0 the face that becomes the catenoid's inside is cyan and the other violet, and the dark squares of each sink toward indigo. The line v = 0 stays warm white.
// Knob 2: Speed. At 2 the surface takes 4 seconds to bend from the helicoid to the catenoid, lingering a little at each end, and turns once about its axis in 20 seconds; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Squares. How many checker squares go once round in u: 12 where it opens, where a square is about 9 LEDs on the line v = 0 and 16 at the free edge, and 36 at the top. The count is always even, so the checker closes up across the catenoid's seam.
// Knob 4: Tilt. How far we look down on the surface: 12 degrees at 0, 15 where it opens, 60 at 1, and the view nods 24 degrees further down as the catenoid forms so we see into its mouth. The scale is set once per tilt from the tallest moment of the bending. It never zooms while the surface bends, so the squares keep their size on the panel too.
// Buttons: K1 tap holds the bending where it is while the surface keeps turning; tap again to let it go on.

const W = 64, H = 128, N = W * H;
const { min, max, floor, round, sqrt, sin, cos, abs, pow, sinh, cosh, tanh, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// The surface, for the bending angle th:
//   x =  cos th sinh v sin u + sin th cosh v cos u
//   y = -cos th sinh v cos u + sin th cosh v sin u
//   z =  u cos th + v sin th
// th = 0 is the helicoid, th = pi/2 the catenoid. Its first fundamental
// form is cosh^2 v (du^2 + dv^2) for every th, so a square in (u, v)
// stays a square, and its normal (cos u / cosh v, sin u / cosh v, -tanh v)
// does not depend on th either.
const U = PI, V = 1.15;
const NU = 96, NV = 30, VU = NU + 1, VV = NV + 1, NPT = VU * VV;
const CAM = 12, CX = 31.5, CY = 63.5;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const s = {
    t: 0, b: 0, phi: 0.35, hold: false, hue: 0, squares: 12, tilt: 0.06, scaleTilt: -1, S: 18,
    gu: F(NPT), gv: F(NPT), su: F(NPT), cu: F(NPT), sh: F(NPT), ch: F(NPT),
    sx: F(NPT), sy: F(NPT), sd: F(NPT),
    zb: F(N), pu: F(N), pv: F(N), side: new Int8Array(N), col: F(N * 3),
    pal: F(12), palHue: -1,
  };
  for (let j = 0; j < VV; j++)
    for (let i = 0; i < VU; i++) {
      const k = j * VU + i, u = -U + (2 * U * i) / NU, v = -V + (2 * V * j) / NV;
      s.gu[k] = u;
      s.gv[k] = v;
      s.su[k] = sin(u);
      s.cu[k] = cos(u);
      s.sh[k] = sinh(v);
      s.ch[k] = cosh(v);
    }
  params.s = s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 12, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3);
  s.squares = 2 * round(cl(k[2], 12, 36) / 2);
  s.tilt = cl(k[3], 0, 1);
  if (input.btnPressed && input.btnPressed[0]) s.hold = !s.hold;
  s.t += d * sp;
  s.phi += d * sp * 0.157;
  if (!s.hold) s.b += d * sp * 0.125;
}

// The bending angle: a quarter turn of th per unit of b, slowed near the
// helicoid and the catenoid so each end holds for a moment.
function bend(b) {
  const n = floor(b), f = b - n;
  return (PI / 2) * (n + f - (0.7 * sin(TAU * f)) / TAU);
}

// The camera nods down as the catenoid forms, so we look into its mouth.
const look = (e0, st) => min(1.25, e0 + 0.42 * st * st);

// One scale per tilt: the largest the surface ever gets on the panel over
// the whole bending and every turn, so the picture never zooms.
function fit(s, e0) {
  let mu = 0, mx = 0;
  for (let a = 0; a <= 24; a++) {
    const th = (PI / 2) * (a / 24), ct = cos(th), st = sin(th), e = look(e0, st), ce = cos(e), se = sin(e);
    for (let r = 0; r < 16; r++) {
      const ph = (TAU * r) / 16, cp = cos(ph), spn = sin(ph);
      for (let q = 0; q < 48; q++) {
        let u, v;
        if (q < 16) (u = q < 8 ? -U : U), (v = -V + (2 * V * (q % 8)) / 7);
        else (u = -U + (2 * U * (q - 16)) / 31), (v = q & 1 ? V : -V);
        const x = ct * sinh(v) * sin(u) + st * cosh(v) * cos(u), y = -ct * sinh(v) * cos(u) + st * cosh(v) * sin(u), z = u * ct + v * st;
        const xr = x * cp - y * spn, yr = x * spn + y * cp;
        const dep = yr * ce - z * se, up = yr * se + z * ce, f = CAM / (CAM + dep);
        mu = max(mu, abs(up * f));
        mx = max(mx, abs(xr * f));
      }
    }
  }
  s.S = min(65 / mu, 33.5 / mx);
  s.scaleTilt = s.tilt;
}

function palette(s) {
  // Light and dark squares of the outer face, then of the inner face.
  // A dark square is its light square at 0.4 over an indigo floor, so a
  // warm face darkens toward plum rather than brown or olive.
  hsv(s.hue + 0.52, 0.5, 1, s.pal, 0);
  hsv(s.hue + 0.8, 0.45, 1, s.pal, 6);
  for (const o of [0, 6]) {
    s.pal[o + 3] = 0.4 * s.pal[o] + 0.1;
    s.pal[o + 4] = 0.4 * s.pal[o + 1] + 0.03;
    s.pal[o + 5] = 0.4 * s.pal[o + 2] + 0.28;
  }
  s.palHue = s.hue;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (s.palHue !== s.hue) palette(s);
  const e0 = ((12 + 48 * s.tilt) * PI) / 180;
  if (s.scaleTilt !== s.tilt) fit(s, e0);
  const th = bend(s.b), ct = cos(th), st = sin(th), cp = cos(s.phi), spn = sin(s.phi), S = s.S;
  const e = look(e0, st), ce = cos(e), se = sin(e);
  const { gu, gv, su, cu, sh, ch, sx, sy, sd, zb, pu, pv, side, col, pal } = s;
  for (let k = 0; k < NPT; k++) {
    const x = ct * sh[k] * su[k] + st * ch[k] * cu[k], y = -ct * sh[k] * cu[k] + st * ch[k] * su[k], z = gu[k] * ct + gv[k] * st;
    const xr = x * cp - y * spn, yr = x * spn + y * cp;
    const dep = yr * ce - z * se, up = yr * se + z * ce, f = (S * CAM) / (CAM + dep);
    sx[k] = CX + f * xr;
    sy[k] = CY - f * up;
    sd[k] = dep;
  }
  zb.fill(1e9);
  side.fill(0);
  for (let j = 0; j < NV; j++)
    for (let i = 0; i < NU; i++) {
      const a = j * VU + i;
      tri(s, a, a + 1, a + VU + 1);
      tri(s, a, a + VU + 1, a + VU);
    }
  const n = s.squares, dl = TAU / n;
  // Light from the upper left, in front: (screen x, depth, screen up).
  const LX = -0.45, LD = -0.62, LU = 0.64, HD = LD - 1, HL = 1 / sqrt(LX * LX + LU * LU + HD * HD);
  const lw = 0.62 / S;
  for (let q = 0; q < N; q++) {
    const o = q * 3, sd0 = side[q];
    if (!sd0) {
      col[o] = col[o + 1] = col[o + 2] = 0;
      continue;
    }
    const u = pu[q], v = pv[q], cv = cosh(v);
    // The normal, the same for every th, turned with the surface.
    const nx = cos(u) / cv, ny = sin(u) / cv, nz = -tanh(v);
    let mx = nx * cp - ny * spn;
    const nyr = nx * spn + ny * cp;
    let md = nyr * ce - nz * se, mu = nyr * se + nz * ce;
    if (md > 0) (mx = -mx), (md = -md), (mu = -mu);
    const ld = max(0, mx * LX + md * LD + mu * LU), hh = max(0, (mx * LX + md * HD + mu * LU) * HL);
    // Light falls off toward an indigo shade rather than toward black.
    const spc = pow(hh, 24) * 0.45, lit = 0.2 + 0.8 * ld, sh0 = (1 - ld) * 0.16;
    const par = (floor((u + U) / dl) + floor(v / dl)) & 1, c = (sd0 > 0 ? 0 : 6) + par * 3;
    let r = pal[c] * lit + 0.3 * sh0 + spc, g = pal[c + 1] * lit + 0.1 * sh0 + spc, b = pal[c + 2] * lit + sh0 + spc;
    // The line v = 0: the helicoid's axis and the catenoid's waist, the
    // same length 2 pi all the way through the bending.
    if (abs(v) < lw) (r = 1 * (0.45 + 0.55 * lit)), (g = 0.86 * (0.45 + 0.55 * lit)), (b = 0.62 * (0.45 + 0.55 * lit));
    col[o] = r;
    col[o + 1] = g;
    col[o + 2] = b;
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, o = q * 3;
      if (side[q]) {
        // Where one sheet passes in front of another, or the ribbon turns
        // over at a fold, a darker LED keeps the two apart.
        let k = 255;
        const rq = x < W - 1 ? q + 1 : q, dq = y < H - 1 ? q + W : q;
        if ((side[rq] && (side[rq] !== side[q] || abs(zb[rq] - zb[q]) > 0.4)) || (side[dq] && (side[dq] !== side[q] || abs(zb[dq] - zb[q]) > 0.4))) k = 120;
        display.setPixel(x, y, min(255, col[o] * k), min(255, col[o + 1] * k), min(255, col[o + 2] * k));
        continue;
      }
      // An empty LED on the outline takes a little of its lit neighbours.
      let r = 0, g = 0, b = 0;
      if (x > 0 && side[q - 1]) (r += col[o - 3]), (g += col[o - 2]), (b += col[o - 1]);
      if (x < W - 1 && side[q + 1]) (r += col[o + 3]), (g += col[o + 4]), (b += col[o + 5]);
      if (y > 0 && side[q - W]) (r += col[o - W * 3]), (g += col[o - W * 3 + 1]), (b += col[o - W * 3 + 2]);
      if (y < H - 1 && side[q + W]) (r += col[o + W * 3]), (g += col[o + W * 3 + 1]), (b += col[o + W * 3 + 2]);
      display.setPixel(x, y, r * 22, g * 22, b * 22);
    }
}

// One triangle of the (u, v) grid into the depth buffer. Its winding on
// the screen says which face of the surface we see there.
function tri(s, i0, i1, i2) {
  const { sx, sy, sd, gu, gv, zb, pu, pv, side } = s;
  const x0 = sx[i0], y0 = sy[i0], x1 = sx[i1], y1 = sy[i1], x2 = sx[i2], y2 = sy[i2];
  const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (abs(den) < 1e-9) return;
  const inv = 1 / den, sg = den > 0 ? 1 : -1;
  const X0 = max(0, Math.ceil(min(x0, x1, x2) - 0.5)), X1 = min(W - 1, floor(max(x0, x1, x2) - 0.5));
  const Y0 = max(0, Math.ceil(min(y0, y1, y2) - 0.5)), Y1 = min(H - 1, floor(max(y0, y1, y2) - 0.5));
  if (X0 > X1 || Y0 > Y1) return;
  const z0 = sd[i0], dz1 = sd[i1] - z0, dz2 = sd[i2] - z0;
  const u0 = gu[i0], du1 = gu[i1] - u0, du2 = gu[i2] - u0, v0 = gv[i0], dv1 = gv[i1] - v0, dv2 = gv[i2] - v0;
  for (let y = Y0; y <= Y1; y++) {
    const cy = y + 0.5 - y0;
    for (let x = X0; x <= X1; x++) {
      const cx = x + 0.5 - x0;
      const a = (cx * (y2 - y0) - cy * (x2 - x0)) * inv, b = ((x1 - x0) * cy - (y1 - y0) * cx) * inv;
      if (a < -1e-6 || b < -1e-6 || a + b > 1 + 1e-6) continue;
      const dd = z0 + dz1 * a + dz2 * b, q = y * W + x;
      if (dd < zb[q]) (zb[q] = dd), (pu[q] = u0 + du1 * a + du2 * b), (pv[q] = v0 + dv1 * a + dv2 * b), (side[q] = sg);
    }
  }
}
