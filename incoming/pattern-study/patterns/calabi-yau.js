// ===== Patternflow pattern =====
// Title:   Calabi-Yau Quintic
// Family:  space
// Idea:    The complex curve z1^5 + z2^5 = 1, a slice of the quintic Calabi-Yau, built from Andrew Hanson's 25 patches and projected into space, turns slowly on black with each patch in its own colour, so the seams show where the patches join and where five of them fan in to one point.
// Author:  patternflow-lab
// Date:    2026-10-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Calabi-Yau manifolds (Eugenio Calabi, 1954; Shing-Tung Yau, 1977), the Fermat quintic slice drawn after Andrew J. Hanson (1994), pattern round 51
// Round:   51
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Angle=-45..45, Spread=0..1
//
// Knob 1: Hue. Turns every patch round the wheel together. A patch takes its hue from k1, the fifth root of unity in front of z1, and a small shift from k2: at 0 the five k1 families are cyan, violet, rose, orange and green.
// Knob 2: Speed. At 2 the surface turns once about its upright axis in 24 seconds and nods 18 degrees up and down every 16; at 0.2 ten times slower, at 3 half as fast again.
// Knob 3: Angle. The projection angle alpha, in degrees from Hanson's 45. The upright axis shows cos(alpha) Im z1 + sin(alpha) Im z2, so at -45 it is Im z1 alone and at 45 Im z2 alone, and the whole surface reshapes as the knob turns.
// Knob 4: Spread. An exploded view: each patch moves out from the centre along the line to its own middle, stretched 1.8 times up and down and 0.8 times across so the pieces use the panel's height. Whole at 0.06, 25 separate pieces at 1.

const W = 64, H = 128, N = W * H;
const { min, max, floor, sqrt, sin, cos, atan2, hypot, abs, pow, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// Grid of one patch: NU steps across x in [-A, A], NV across y in [0, pi/2].
const NU = 24, NV = 12, VU = NU + 1, VV = NV + 1, PV = VU * VV, NP = 25 * PV, A = 1.1;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// Hanson's patch (k1, k2) at z = x + iy:
// z1 = e^(2 pi i k1/5) cosh(z)^(2/5), z2 = e^(2 pi i k2/5) (-i sinh z)^(2/5),
// principal branches, so z1^5 + z2^5 = cosh^2 z - sinh^2 z = 1.
function point(k1, k2, x, y, out, o) {
  const cr = Math.cosh(x) * cos(y), ci = Math.sinh(x) * sin(y);
  const sr = Math.sinh(x) * cos(y), si = Math.cosh(x) * sin(y);
  // -i sinh z
  const mr = si, mi = -sr;
  const r1 = pow(hypot(cr, ci), 0.4), a1 = 0.4 * atan2(ci, cr) + (TAU * k1) / 5;
  const r2 = pow(hypot(mr, mi), 0.4), a2 = 0.4 * atan2(mi, mr) + (TAU * k2) / 5;
  out[o] = r1 * cos(a1);
  out[o + 1] = r1 * sin(a1);
  out[o + 2] = r2 * cos(a2);
  out[o + 3] = r2 * sin(a2);
}

export function setup(params) {
  const F = (n) => new Float32Array(n);
  const s = {
    t: 0, yaw: 0.6, hue: 0, alpha: PI / 4, spread: 0.06,
    // Re z1, Im z1, Re z2, Im z2 for every grid point of every patch.
    z: F(NP * 4), cen: F(25 * 4),
    px: F(NP), py: F(NP), pz: F(NP), sx: F(NP), sy: F(NP), nx: F(NP), ny: F(NP), nz: F(NP),
    zb: F(N), id: new Int16Array(N), wa: F(N), wb: F(N), tv: new Int32Array(N), col: F(N * 3),
    pal: F(25 * 3), palHue: -1,
  };
  // The grid crowds toward x = 0 and toward both ends of y, where the
  // patches meet at the points z2 = 0 and z1 = 0 and the 2/5 power stretches them.
  const gx = F(VU), gy = F(VV);
  for (let i = 0; i < VU; i++) {
    const u = (2 * i) / NU - 1;
    gx[i] = A * Math.sign(u) * pow(abs(u), 1.7);
  }
  for (let j = 0; j < VV; j++) gy[j] = (PI / 4) * (1 - cos((PI * j) / NV));
  for (let p = 0; p < 25; p++) {
    const k1 = (p / 5) | 0, k2 = p % 5;
    for (let j = 0; j < VV; j++)
      for (let i = 0; i < VU; i++) {
        const v = p * PV + j * VU + i;
        point(k1, k2, gx[i], gy[j], s.z, v * 4);
        for (let c = 0; c < 4; c++) s.cen[p * 4 + c] += s.z[v * 4 + c] / PV;
      }
  }
  params.s = s;
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, k = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(k[0], 0, 1);
  const sp = cl(k[1], 0.2, 3);
  s.alpha = ((45 + cl(k[2], -45, 45)) * PI) / 180;
  s.spread = cl(k[3], 0, 1);
  s.t += d * sp;
  s.yaw += d * sp * 0.13;
}

function palette(s) {
  for (let p = 0; p < 25; p++) {
    const k1 = (p / 5) | 0, k2 = p % 5;
    hsv(s.hue + 0.5 + 0.2 * k1 + 0.035 * (k2 - 2), 0.62 + 0.07 * k2, 1, s.pal, p * 3);
  }
  s.palHue = s.hue;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  if (s.palHue !== s.hue) palette(s);
  const { z, cen, px, py, pz, sx, sy, nx, ny, nz, zb, id, wa, wb, tv, col, pal } = s;
  const ca = cos(s.alpha), sa = sin(s.alpha);
  // The turn about the upright (projected) axis and a slow nod.
  const cy = cos(s.yaw), sy0 = sin(s.yaw), el = 0.32 * sin(s.t * 0.19), ce = cos(el), se = sin(el);
  const sc = 19.5 / (1 + 0.25 * s.spread), CX = 31.5, CY = 64, CAM = 8;
  const sp = s.spread;
  for (let p = 0; p < 25; p++) {
    // The patch's own middle, turned like the rest; the exploded view moves
    // the patch out along it, 1.8 times as far up and down and 0.8 across.
    const X = cen[p * 4] * sp, Y = cen[p * 4 + 2] * sp, Z = (ca * cen[p * 4 + 1] + sa * cen[p * 4 + 3]) * sp;
    const xr = X * cy - Y * sy0, yr = X * sy0 + Y * cy;
    const ox = xr * 0.8, oz = (yr * se + Z * ce) * 1.8, oy = yr * ce - Z * se;
    for (let v = p * PV, e = v + PV; v < e; v++) {
      const X = z[v * 4], Y = z[v * 4 + 2], Z = ca * z[v * 4 + 1] + sa * z[v * 4 + 3];
      // Yaw about the upright axis, then the nod about the screen's x axis.
      const xr = X * cy - Y * sy0, yr = X * sy0 + Y * cy;
      const yy = yr * ce - Z * se + oy, zz = yr * se + Z * ce + oz, xx = xr + ox;
      px[v] = xx;
      py[v] = zz;
      pz[v] = yy;
      const f = (sc * CAM) / (CAM + yy);
      sx[v] = CX + f * xx;
      sy[v] = CY - f * zz;
    }
  }
  // Normals from the grid's neighbours.
  for (let p = 0; p < 25; p++)
    for (let j = 0; j < VV; j++)
      for (let i = 0; i < VU; i++) {
        const v = p * PV + j * VU + i;
        const a = i > 0 ? v - 1 : v, b = i < NU ? v + 1 : v, c = j > 0 ? v - VU : v, e = j < NV ? v + VU : v;
        const ux = px[b] - px[a], uy = py[b] - py[a], uz = pz[b] - pz[a];
        const wx = px[e] - px[c], wy = py[e] - py[c], wz = pz[e] - pz[c];
        const qx = uy * wz - uz * wy, qy = uz * wx - ux * wz, qz = ux * wy - uy * wx;
        const l = 1 / (sqrt(qx * qx + qy * qy + qz * qz) + 1e-12);
        nx[v] = qx * l;
        ny[v] = qy * l;
        nz[v] = qz * l;
      }
  zb.fill(1e9);
  id.fill(-1);
  for (let p = 0; p < 25; p++)
    for (let j = 0; j < NV; j++)
      for (let i = 0; i < NU; i++) {
        const v = p * PV + j * VU + i;
        tri(s, v, v + 1, v + VU + 1, p);
        tri(s, v, v + VU + 1, v + VU, p);
      }
  // Shade into col.
  const LX = -0.5, LY = 0.6, LZ = -0.62, HZ = LZ - 1, HL = 1 / sqrt(LX * LX + LY * LY + HZ * HZ);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, p = id[q], o = q * 3;
      if (p < 0) {
        col[o] = col[o + 1] = col[o + 2] = 0;
        continue;
      }
      const t0 = tv[q], a = wa[q], b = wb[q], c = 1 - a - b;
      const v0 = t0 & 0x3fff, v1 = v0 + ((t0 >> 14) & 0xff), v2 = v0 + ((t0 >> 22) & 0xff);
      let mx = nx[v0] * c + nx[v1] * a + nx[v2] * b, my = ny[v0] * c + ny[v1] * a + ny[v2] * b, mz = nz[v0] * c + nz[v1] * a + nz[v2] * b;
      const l = 1 / (sqrt(mx * mx + my * my + mz * mz) + 1e-12);
      mx *= l;
      my *= l;
      mz *= l;
      // Two-sided: the eye looks along +depth, so a normal is turned to face it.
      if (mz > 0) (mx = -mx), (my = -my), (mz = -mz);
      const ld = max(0, mx * LX + my * LY + mz * LZ), hh = max(0, (mx * LX + my * LY + mz * HZ) * HL);
      const spc = pow(hh, 30) * 0.5;
      // The far side dims a quarter; light falls off toward an indigo shade
      // rather than toward black, so a turned-away yellow reads violet, not olive.
      const fog = 1 - 0.25 * cl((zb[q] + 1.6) / 3.2, 0, 1), lit = (0.1 + 0.9 * ld) * fog, sh = (1 - ld) * 0.22 * fog;
      const r = pal[p * 3] * lit + 0.35 * sh + spc, g = pal[p * 3 + 1] * lit + 0.12 * sh + spc, bb = pal[p * 3 + 2] * lit + sh + spc;
      // Seams: an LED beside another patch, joined to it or passing in front, is dimmed.
      const rp = x < W - 1 ? id[q + 1] : p, dp = y < H - 1 ? id[q + W] : p;
      const k = (rp >= 0 && rp !== p) || (dp >= 0 && dp !== p) ? 127 : 255;
      col[o] = min(255, r * k);
      col[o + 1] = min(255, g * k);
      col[o + 2] = min(255, bb * k);
    }
  // An empty LED on the outline takes a third of its lit neighbours'
  // light, which softens the stairs of the edge against black.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = y * W + x, o = q * 3;
      if (id[q] >= 0) {
        display.setPixel(x, y, col[o], col[o + 1], col[o + 2]);
        continue;
      }
      let r = 0, g = 0, b = 0;
      for (const n of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, y > 0 ? q - W : -1, y < H - 1 ? q + W : -1])
        if (n >= 0 && id[n] >= 0) (r += col[n * 3]), (g += col[n * 3 + 1]), (b += col[n * 3 + 2]);
      display.setPixel(x, y, r * 0.09, g * 0.09, b * 0.09);
    }
}

// One triangle into the depth buffer, keeping the barycentric weights of
// the nearest surface at each LED centre.
function tri(s, i0, i1, i2, p) {
  const { sx, sy, pz, zb, id, wa, wb, tv } = s;
  const x0 = sx[i0], y0 = sy[i0], x1 = sx[i1], y1 = sy[i1], x2 = sx[i2], y2 = sy[i2];
  const den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (abs(den) < 1e-9) return;
  const inv = 1 / den;
  let xa = min(x0, x1, x2), xb = max(x0, x1, x2), ya = min(y0, y1, y2), yb = max(y0, y1, y2);
  const X0 = max(0, Math.ceil(xa - 0.5)), X1 = min(W - 1, floor(xb - 0.5)), Y0 = max(0, Math.ceil(ya - 0.5)), Y1 = min(H - 1, floor(yb - 0.5));
  if (X0 > X1 || Y0 > Y1) return;
  const z0 = pz[i0], z1 = pz[i1], z2 = pz[i2];
  const pack = i0 | ((i1 - i0) << 14) | ((i2 - i0) << 22);
  for (let y = Y0; y <= Y1; y++) {
    const cy = y + 0.5 - y0;
    for (let x = X0; x <= X1; x++) {
      const cx = x + 0.5 - x0;
      const a = (cx * (y2 - y0) - cy * (x2 - x0)) * inv, b = ((x1 - x0) * cy - (y1 - y0) * cx) * inv;
      if (a < -1e-6 || b < -1e-6 || a + b > 1 + 1e-6) continue;
      const d = z0 + (z1 - z0) * a + (z2 - z0) * b, q = y * W + x;
      if (d < zb[q]) (zb[q] = d), (id[q] = p), (wa[q] = a), (wb[q] = b), (tv[q] = pack);
    }
  }
}
