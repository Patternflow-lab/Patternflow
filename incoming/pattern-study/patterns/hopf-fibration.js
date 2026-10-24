// ===== Patternflow pattern =====
// Title:   Hopf Fibration
// Family:  topology
// Idea:    The 3-sphere filled with circles, one over each point of the 2-sphere, stereographically projected into space and seen in perspective: the fibres over each circle of latitude sweep out a torus, the tori nest round a ring and a vertical line through infinity, and any two circles link exactly once.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Hopf fibration (Heinz Hopf, 1931), pattern round 29
// Round:   29
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Rings=5..7, Fibres=14..17
//
// Knob 1: Hue. Turns the colours round the wheel; each fibre takes its hue from the longitude of its base point.
// Knob 2: Speed. How fast the base points run round their latitudes (the tori turn, neighbours the opposite way), the latitudes breathe and the view rocks.
// Knob 3: Rings. How many circles of latitude carry base points, 5 to 7; each is one torus, and the outer ones open into tall loops round the line.
// Knob 4: Fibres. How many fibres each torus has, from 14 to 17.
// Buttons: K1 tap lights two fibres from different tori and dims the rest for five seconds, so you can follow them through each other. K2 tap tilts the circles of base points on the sphere, so the tori lean over and turn lopsided; tap again to stand them up.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, atan2, acos, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// Points round one fibre, and the most fibres on show: seven tori of
// seventeen, the ring and the line.
const NT = 96, MAXF = 7 * 17 + 2, MAXS = MAXF * NT;
const CT = new Float32Array(NT), ST = new Float32Array(NT);
for (let i = 0; i < NT; i++) (CT[i] = cos((TAU * i) / NT)), (ST[i] = sin((TAU * i) / NT));

// Camera distance from the middle of the ring and focal length in LEDs: the
// ring, radius 1, is 16 LEDs from the line. Depth bins for the painter.
const D = 7, F = D * 16, CX = 31.5, CY = 64, NB = 64, NEAR = 0.4;
// Polar angles of the innermost and outermost circle of base points.
const TH0 = 0.6, TH1 = 2.35;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const c = i === 0 ? [v, t, p] : i === 1 ? [q, v, p] : i === 2 ? [p, v, t] : i === 3 ? [p, q, v] : i === 4 ? [t, p, v] : [v, p, q];
  out[o] = c[0] * 255;
  out[o + 1] = c[1] * 255;
  out[o + 2] = c[2] * 255;
}

export function setup(params) {
  const F32 = (n) => new Float32Array(n), I32 = (n) => new Int32Array(n);
  params.s = {
    T: 0, tilt: 0, tiltTo: 0, pair: 0, hue: 0, rings: 5, fib: 14, ns: 0, cam: new Float64Array(8),
    buf: F32(N * 3),
    // Every fibre point on screen with its depth.
    sx: F32(MAXS), sy: F32(MAXS), sz: F32(MAXS),
    col: F32(MAXF * 3), lit: F32(MAXF), pp: F32(MAXF),
    // Segments as (first point, last point), sorted far to near by depth bin.
    sa: I32(MAXS), sb: I32(MAXS), key: new Uint8Array(MAXS), ord: I32(MAXS), bin: I32(NB + 1),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const P = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  P.hue = cl(k[0], 0, 1);
  P.T += d * cl(k[1], 0.2, 3);
  P.rings = cl(k[2], 5, 7);
  P.fib = cl(k[3], 14, 17);
  const b = input.btnPressed || [];
  if (b[0]) P.pair = 5;
  if (b[1]) P.tiltTo = P.tiltTo ? 0 : 1;
  P.pair = max(0, P.pair - d);
  P.tilt += cl(P.tiltTo - P.tilt, -d * 0.5, d * 0.5);
}

// One fibre into the point arrays. The base point sits at polar angle th
// from the pole whose fibre is the ring, at longitude ph; with a = th/2 its
// fibre is (cos a e^{i(t+ph)}, sin a e^{it}) on the 3-sphere, projected
// stereographically from (0,0,0,1) and then through the camera.
function fibre(P, f, th, ph, cam) {
  const a = th / 2, ca = cos(a), sa = sin(a), cp = cos(ph) * ca, sp = sin(ph) * ca;
  const rx = cam[0], ry = cam[1], ux = cam[2], uy = cam[3], uz = cam[4], fx = cam[5], fy = cam[6], fz = cam[7];
  const sx = P.sx, sy = P.sy, sz = P.sz;
  for (let i = 0, o = f * NT; i < NT; i++, o++) {
    const c = CT[i], s = ST[i], q = 1 / (1 - sa * s + 1e-6);
    const X = (c * cp - s * sp) * q, Y = (s * cp + c * sp) * q, Z = sa * c * q;
    const iz = F / (D + X * fx + Y * fy + Z * fz);
    sz[o] = F / iz;
    sx[o] = CX + (X * rx + Y * ry) * iz;
    sy[o] = CY - (X * ux + Y * uy + Z * uz) * iz;
  }
}

// One segment: an antialiased core whose half width hw comes from depth, and
// a faint halo hl wide of the same light. Each LED is pulled toward the
// line's colour by its cover, so a near strand passes over a far one with a
// thin dark seam: that seam is what shows which of two fibres is in front.
// The segment is walked one LED at a time along its longer axis and owns the
// LEDs whose centres fall in [start, end) there, so the segments of one
// fibre meet without gaps or double cover.
function line(buf, x0, y0, x1, y1, r, g, b, hw, hl, op) {
  const dx = x1 - x0, dy = y1 - y0, E = hw + 0.5 + hl, flat = abs(dx) >= abs(dy);
  if (abs(dx) + abs(dy) < 1e-3) return;
  // Along the major axis a, across it c; k is the slope, cs the cosine that
  // turns a distance across into a distance from the line.
  const a0 = flat ? x0 : y0, a1 = flat ? x1 : y1, c0 = flat ? y0 : x0, k = flat ? dy / dx : dx / dy;
  const cs = 1 / sqrt(1 + k * k), ec = E / cs, na = flat ? W : H, nc = flat ? H : W, sa = flat ? 3 : W * 3, sc = flat ? W * 3 : 3;
  const s0 = max(0, Math.ceil(min(a0, a1) - 0.5)), s1 = min(na - 1, Math.ceil(max(a0, a1) - 0.5) - 1);
  for (let i = s0; i <= s1; i++) {
    const cc = c0 + (i + 0.5 - a0) * k, j0 = max(0, Math.ceil(cc - ec - 0.5)), j1 = min(nc - 1, floor(cc + ec - 0.5));
    for (let j = j0, q = i * sa + j0 * sc; j <= j1; j++, q += sc) {
      const e = (j + 0.5 - cc) * cs, dd = (e < 0 ? -e : e) - hw;
      if (dd > E - hw) continue;
      const w = (dd < -0.5 ? 1 : dd < 0.2 ? 0.5 - dd : dd < 0.5 ? 0.3 : (0.3 * (E - hw - dd)) / hl) * op;
      buf[q] += (r - buf[q]) * w;
      buf[q + 1] += (g - buf[q + 1]) * w;
      buf[q + 2] += (b - buf[q + 2]) * w;
    }
  }
}

// One segment into the depth bins, unless it is off the panel or stretched
// across it by passing close to the camera.
function emit(P, a, b) {
  const { sx, sy, sz } = P, x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b];
  if (abs(x1 - x0) + abs(y1 - y0) >= 70) return;
  if ((x0 < -3 && x1 < -3) || (x0 > W + 3 && x1 > W + 3) || (y0 < -3 && y1 < -3) || (y0 > H + 3 && y1 > H + 3)) return;
  const kb = cl(floor((((sz[a] + sz[b]) / 2 - (D - 4)) / 8) * NB), 0, NB - 1);
  P.key[P.ns] = kb;
  P.sa[P.ns] = a;
  P.sb[P.ns++] = b;
  P.bin[kb + 1]++;
}

export function draw(display, params) {
  const P = params.s;
  if (!P) return;
  const T = P.T, buf = P.buf, { sx, sy, sz, sa, sb, key, ord, bin, col, lit } = P;
  buf.fill(0);
  // The camera turns slowly round the line and rocks between looking across
  // the tori and looking down into the ring.
  const az = 0.5 + T * 0.05, el = 0.75 + 0.2 * sin(T * 0.11);
  const ce = cos(el), se = sin(el), ca = cos(az), sn = sin(az);
  const cam = P.cam;
  cam[0] = -sn;
  cam[1] = ca;
  cam[2] = -se * ca;
  cam[3] = -se * sn;
  cam[4] = ce;
  cam[5] = -ce * ca;
  cam[6] = -ce * sn;
  cam[7] = -se;
  const nr = P.rings, n = floor(P.fib), tl = sm(P.tilt) * 1.1, ct = cos(tl), st = sin(tl);
  // After a K1 tap one fibre of the innermost torus and one of the next stay
  // lit and the rest dim to under a third.
  const hi = sm(P.pair) * 0.7, pick0 = 0, pick1 = floor(n / 2) + 1;
  let nf = 0;
  for (let j = 0; j < 7; j++) {
    const on = cl(nr - j, 0, 1);
    if (on <= 0) break;
    // Latitudes spread evenly from near the ring's pole to near the line's,
    // each breathing on its own phase; a ring the knob is still bringing in
    // fades up on the outermost one while the others close up.
    const u = min(j, nr - 1) / (nr - 1), th0 = TH0 + (TH1 - TH0) * u + 0.1 * sin(T * 0.35 + j * 1.7), dir = j & 1 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const ph = (TAU * i) / n + dir * T * 0.25 + j * 0.4;
      // The base point, its circle of latitude tipped about the x axis.
      const bx = sin(th0) * cos(ph), by0 = sin(th0) * sin(ph), bz0 = cos(th0);
      const by = by0 * ct - bz0 * st, bz = by0 * st + bz0 * ct;
      fibre(P, nf, acos(cl(bz, -1, 1)), atan2(by, bx), cam);
      // Hue from longitude, and paler toward the ring's pole, deeper and
      // darker toward the line's.
      hsv(P.hue + 0.55 + i / n, 0.45 + 0.5 * u, on * (1 - 0.4 * u), col, nf * 3);
      const picked = (j === 0 && i === pick0) || (j === 1 && i === pick1);
      lit[nf] = picked ? 1 + hi : 1 - hi;
      P.pp[nf] = ph + j * 1.3;
      nf++;
    }
  }
  // The ring, fibre over one pole, and the line through infinity, the fibre
  // over the other: on the panel a vertical line through the middle.
  const rl = 1 - hi * 0.6;
  fibre(P, nf, 0, 0, cam);
  P.pp[nf] = 0;
  col[nf * 3] = col[nf * 3 + 1] = 170;
  col[nf * 3 + 2] = 185;
  lit[nf++] = rl;
  for (let i = 0, o = nf * NT; i < NT; i++, o++) {
    const Z = (i / (NT - 1) - 0.5) * 60, zc = D + Z * cam[7];
    sz[o] = zc;
    sx[o] = CX;
    sy[o] = CY - (F * Z * cam[4]) / zc;
  }
  col[nf * 3] = col[nf * 3 + 1] = 170;
  col[nf * 3 + 2] = 185;
  P.pp[nf] = 0;
  lit[nf++] = rl;

  // Cut each fibre into segments as long as they can be while the curve
  // between their ends stays within 0.3 LED of the chord (and under 12 LEDs),
  // skipping what lies behind the camera or off the panel; bin them by depth.
  bin.fill(0);
  P.ns = 0;
  for (let f = 0; f < nf; f++) {
    const o = f * NT, end = f < nf - 1 ? NT : NT - 1;
    let ia = 0;
    for (let i = 1; i <= end; ) {
      const a = o + ia, b = o + (i % NT), ok = sz[a] > NEAR && sz[b] > NEAR;
      if (ok && i < end && i - ia < 16) {
        const dx = sx[b] - sx[a], dy = sy[b] - sy[a], m = o + ((ia + i) >> 1);
        const dev = abs(dx * (sy[m] - sy[a]) - dy * (sx[m] - sx[a])) / (sqrt(dx * dx + dy * dy) + 1e-6);
        if (abs(dx) + abs(dy) < 12 && dev < 0.3) {
          i++;
          continue;
        }
        if (i - ia > 1) {
          emit(P, a, b - 1);
          ia = i - 1;
          continue;
        }
      }
      if (ok) emit(P, a, b);
      ia = i++;
    }
  }
  const ns = P.ns;
  for (let i = 1; i <= NB; i++) bin[i] += bin[i - 1];
  for (let s = 0; s < ns; s++) ord[bin[key[s]]++] = s;
  // Far to near. A fibre is lit 1 near the camera and a quarter far off,
  // and its core is two LEDs wide near and one far. A slow swell of light
  // runs round every fibre at the same rate: the circle action of the
  // fibration, which moves each point of the 3-sphere along its own fibre.
  // Each fibre's swell starts from its own longitude so the whole picture
  // never dims at once.
  for (let r = ns - 1; r >= 0; r--) {
    const s = ord[r], a = sa[s], b = sb[s], f = floor(a / NT), c = f * 3, lf = lit[f];
    const dn = cl(((sz[a] + sz[b]) / 2 - (D - 3)) / 6, 0, 1) * (lf > 1 ? 2 - lf : 1);
    const v = (1 - 0.75 * dn) * lf * (0.72 + 0.28 * cos((TAU * (a % NT)) / NT + P.pp[f] - 1.6 * T));
    line(buf, sx[a], sy[a], sx[b], sy[b], min(255, col[c] * v), min(255, col[c + 1] * v), min(255, col[c + 2] * v), 0.25 + 0.6 * (1 - dn), 0.05 + 0.65 * (1 - dn), lf < 1 ? lf * lf : 1);
  }
  for (let p = 0, y = 0; y < H; y++) for (let x = 0; x < W; x++, p += 3) display.setPixel(x, y, buf[p], buf[p + 1], buf[p + 2]);
}
