// ===== Patternflow pattern =====
// Title:   Schwarz Lantern
// Family:  geometry
// Idea:    A lantern of flat triangles, every corner on a cylinder the height of the panel, turns under a light while its bands multiply from 3 to 40 and back, and as it folds into a glinting accordion the bar at the left shows its area climbing to 1.88 times the cylinder's.
// Author:  patternflow-lab
// Date:    2026-10-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Schwarz lantern (Hermann Schwarz, 1880), pattern round 36
// Round:   36
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Sides=5..12, Light=0..1
//
// Knob 1: Hue. The lantern's colour once round the wheel; facets tipped up lean a little one way round it and facets tipped down the other. At 0 it is azure with blue tops and teal undersides, at 0.25 violet and pink, at 0.5 orange with gold tops, at 0.75 green; the inside, seen through the open top, is a darker shade 0.12 further round.
// Knob 2: Speed. At 2 the lantern turns once in 26 s, so a facet comes round to the same place every 5 s at five sides, and the bands go from 3 to 40 and back to 3 in 20 s, lingering at both ends; at 0.2 everything takes ten times as long, at 3 two thirds as long.
// Knob 3: Sides. Corners on each ring, n, 5 to 12. The lantern's area goes with the bands over n squared, so the same 40 bands fold it to 1.88 times the cylinder's area at 5 sides, 1.51 at 6, 1.19 at 8 and only 1.04 at 12, where it stays a smooth, finely hatched column and the bar barely moves.
// Knob 4: Light. The height of the light, which comes from the front left. At 0.06 it is 44 degrees above, so the facets tipped up shine and the ones tipped down fall dark and the folds read as stripes; at 0.5 it is level and the two kinds of facet come out alike; at 1 it is 50 degrees below and lights the undersides. A second light high behind the lantern puts glints on the upper facets once the folds are deep.
// Buttons: K1 tap folds the lantern to 40 bands in 0.6 s, holds it there 2 s and lets it ease back over 2 s.

const W = 64, H = 128, SS = 2, SW = W * SS, SH = H * SS, SN = SW * SH;
const { floor, ceil, min, max, sqrt, sin, cos, exp, log, abs, PI } = Math;
const TAU = 2 * PI;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));

// The cylinder: radius R and height HC in LEDs, its axis at column CX, seen
// from EL radians above. The bands run from MMIN to MMAX.
const R = 26, HC = 114, CX = 34.5, EL = 0.2, MMIN = 3, MMAX = 40, NMAX = 12;
// The gauge: the lantern's area over the cylinder's, a bar up from row G0 at
// the left edge, GPX LEDs to the unit, with a mark at 1.
const G0 = 125, GPX = 44;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  const V = (MMAX + 2) * NMAX;
  params.s = {
    hue: 0, speed: 2, n: 5, light: 0.06, spin: 0, sweep: 2.2, snap: -1, mu: MMIN, area: 1,
    ox: new Float32Array(V), oy: new Float32Array(V), oz: new Float32Array(V),
    vx: new Float32Array(V), vy: new Float32Array(V), vz: new Float32Array(V),
    zb: new Float32Array(SN), cr: new Float32Array(SN), cg: new Float32Array(SN), cb: new Float32Array(SN), col: new Float32Array(3),
  };
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, k = input.knobValues || [0, 2, 5, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = k[0];
  S.speed = cl(k[1], 0.2, 3);
  S.n = Math.round(cl(k[2], 5, NMAX));
  S.light = cl(k[3], 0, 1);
  S.spin += d * S.speed * 0.12;
  S.sweep += d * S.speed * 0.16;
  if (S.snap >= 0) {
    S.snap += d;
    if (S.snap > 4.6) S.snap = -1;
  }
  if (input.btnPressed && input.btnPressed[0]) S.snap = S.snap < 0 ? 0 : min(S.snap, 0.6);
  // The bands: MMIN to MMAX and back, evenly in log, lingering at both ends.
  const u = 0.5 - 0.5 * cos(S.sweep);
  let mu = exp(log(MMIN) + log(MMAX / MMIN) * u);
  if (S.snap >= 0) {
    const e = S.snap < 0.6 ? sm(S.snap / 0.6) : 1 - sm((S.snap - 2.6) / 2);
    mu = exp(log(mu) + (log(MMAX) - log(mu)) * e);
  }
  S.mu = mu;
}

// Rasterise one triangle into the supersampled buffers, flat coloured, row
// by row: on each row every edge bounds the run of samples on one side.
function tri(S, ax, ay, az, bx, by, bz, cx, cy, cz, r, g, b) {
  const { zb, cr, cg, cb } = S;
  const det = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (abs(det) < 1e-6) return;
  // Depth as a plane over the screen.
  const dzx = ((bz - az) * (cy - ay) - (cz - az) * (by - ay)) / det;
  const dzy = ((cz - az) * (bx - ax) - (bz - az) * (cx - ax)) / det;
  const s = det > 0 ? 1 : -1;
  const y0 = max(0, ceil(min(ay, by, cy) - 0.5)), y1 = min(SH - 1, floor(max(ay, by, cy) - 0.5));
  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    let xl = 0, xr = SW - 1;
    for (let e = 0; e < 3; e++) {
      const x0 = e === 0 ? ax : e === 1 ? bx : cx, y0e = e === 0 ? ay : e === 1 ? by : cy;
      const x1 = e === 0 ? bx : e === 1 ? cx : ax, y1e = e === 0 ? by : e === 1 ? cy : ay;
      // Inside when s ((x1 - x0)(py - y0) - (y1 - y0)(px - x0)) >= 0, linear in px.
      const A = -s * (y1e - y0e), B = s * ((x1 - x0) * (py - y0e) + (y1e - y0e) * x0);
      if (abs(A) < 1e-9) {
        if (B < 0) xr = -1;
      } else if (A > 0) xl = max(xl, ceil(-B / A - 0.5));
      else xr = min(xr, floor(-B / A - 0.5));
    }
    for (let x = xl; x <= xr; x++) {
      const z = az + dzx * (x + 0.5 - ax) + dzy * (py - ay), p = y * SW + x;
      if (z < zb[p]) {
        zb[p] = z;
        cr[p] = r;
        cg[p] = g;
        cb[p] = b;
      }
    }
  }
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { ox, oy, oz, vx, vy, vz, zb, cr, cg, cb, col } = S;
  const n = S.n, mu = S.mu, K = ceil(mu - 1e-6);
  const ce = cos(EL), se = sin(EL), cxs = CX * SS, cys = 64 * SS;
  const ct = cos(S.spin), st = sin(S.spin);
  // Ring k holds n corners at angles (2 pi j + pi k) / n, so each ring is
  // turned pi / n from the last, at height k h / mu, the last held at the
  // top: at a whole mu this is the lantern with mu bands, and between two
  // whole values the top band opens from flat to full height.
  for (let k = 0; k <= K; k++) {
    const y = min(HC, (k * HC) / mu);
    for (let j = 0; j < n; j++) {
      const a = (TAU * j + PI * k) / n, x = R * cos(a), z = R * sin(a), o = k * n + j;
      ox[o] = x;
      oy[o] = y;
      oz[o] = z;
      // Turn about the axis, then look down by EL.
      const xr = x * ct + z * st, zr = -x * st + z * ct, yc = y - HC / 2;
      vx[o] = cxs + SS * xr;
      vy[o] = cys - SS * (yc * ce + zr * se);
      vz[o] = -yc * se + zr * ce;
    }
  }
  zb.fill(1e9);
  cr.fill(0);
  cg.fill(0);
  cb.fill(0);
  // The light from the front left, its height set by K4: 44 degrees above
  // at the opening, level at 0.5, 50 below at 1. The eye looks along +z.
  const le = 0.87 - 1.74 * S.light, Lx = -0.55 * cos(le), Ly = sin(le), Lz = -0.83 * cos(le);
  const Hx = Lx, Hy = Ly, Hz = Lz - 1, Hn = 1 / sqrt(Hx * Hx + Hy * Hy + Hz * Hz);
  // The half vector of a second light high above and behind, for the
  // glints off deep folds.
  const Gx = 0.25, Gy = 0.8, Gz = -0.45, Gn = 1 / sqrt(Gx * Gx + Gy * Gy + Gz * Gz);
  const h0 = S.hue + 0.55;
  let area = 0;
  for (let k = 0; k < K; k++)
    for (let j = 0; j < n; j++)
      for (let t = 0; t < 2; t++) {
        // t = 0: base on ring k, apex on ring k + 1 between the base's ends.
        // t = 1: base on ring k + 1, apex on ring k between its ends.
        const i0 = t === 0 ? k * n + j : (k + 1) * n + ((j + n - 1) % n);
        const i1 = t === 0 ? k * n + ((j + 1) % n) : (k + 1) * n + j;
        const i2 = t === 0 ? (k + 1) * n + j : k * n + j;
        const ux = ox[i1] - ox[i0], uy = oy[i1] - oy[i0], uz = oz[i1] - oz[i0];
        const wx = ox[i2] - ox[i0], wy = oy[i2] - oy[i0], wz = oz[i2] - oz[i0];
        let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
        const nl = sqrt(nx * nx + ny * ny + nz * nz);
        area += nl / 2;
        if (nl < 1e-9) continue;
        (nx /= nl), (ny /= nl), (nz /= nl);
        // Point the normal out of the cylinder.
        if (nx * (ox[i0] + ox[i1] + ox[i2]) + nz * (oz[i0] + oz[i1] + oz[i2]) < 0) (nx = -nx), (ny = -ny), (nz = -nz);
        const rx = nx * ct + nz * st, rz0 = -nx * st + nz * ct;
        const ry = ny * ce + rz0 * se, rz = -ny * se + rz0 * ce;
        // Outside faces turn toward the eye; the inside shows through the top.
        const out = rz < 0, sx = out ? rx : -rx, sy = out ? ry : -ry, sz = out ? rz : -rz;
        const dif = max(0, sx * Lx + sy * Ly + sz * Lz);
        let lit, spec = 0;
        if (out) {
          const hv = max(0, (sx * Hx + sy * Hy + sz * Hz) * Hn), gv = max(0, (sx * Gx + sy * Gy + sz * Gz) * Gn);
          spec = hv ** 40 * 0.6 + gv ** 40;
          hsv(h0 + 0.1 * ny, 0.85 - 0.1 * abs(ny), 1, col, 0);
          lit = 0.16 + 0.84 * dif;
        } else {
          hsv(h0 + 0.12, 0.7, 1, col, 0);
          lit = 0.1 + 0.3 * dif;
        }
        tri(S, vx[i0], vy[i0], vz[i0], vx[i1], vy[i1], vz[i1], vx[i2], vy[i2], vz[i2], col[0] * lit + spec, col[1] * lit + spec, col[2] * lit + spec);
      }
  // Summed from the triangles themselves; at whole mu it equals
  // A = 2 m n r sin(pi/n) sqrt((h/m)^2 + r^2 (1 - cos(pi/n))^2).
  S.area = area / (TAU * R * HC);

  const f = 255 / (SS * SS);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++)
        for (let dx = 0; dx < SS; dx++) {
          const p = (y * SS + dy) * SW + x * SS + dx;
          r += cr[p];
          g += cg[p];
          b += cb[p];
        }
      // The gauge: a two-LED bar up the left edge, and a mark at 1, where
      // the lantern's area would equal the cylinder's.
      if ((x === 1 || x === 2) && y > G0 - S.area * GPX && y <= G0) r = g = b = 190 / f;
      if (x < 5 && y === G0 - GPX) r = g = b = 255 / f;
      display.setPixel(x, y, cl(r * f, 0, 255), cl(g * f, 0, 255), cl(b * f, 0, 255));
    }
}
