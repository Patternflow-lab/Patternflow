// ===== Patternflow pattern =====
// Title:   Widmanstatten Slice
// Family:  meteorite
// Idea:    A polished and acid-etched slab of an iron meteorite is cut through a three-dimensional crystal that is never drawn, and the cut plane slowly sweeps and tilts through it, so bright steel-blue kamacite plates in four crossing families slide, sprout, taper and vanish over a soft grey-gold plessite field while a raking light glints along their edges.
// Author:  patternflow-lab
// Date:    2026-11-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: The figures that G. Thomson in Naples (about 1804) and Alois von Widmanstatten in Vienna (about 1808) brought out by etching iron meteorites with acid; kamacite plates that grew out of taenite along the octahedral planes of the crystal, as surveyed in Vagn Buchwald, Handbook of Iron Meteorites (1975)
// Round:   214
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Sweep=0..3, Plate=-1..1, Cut=-1..1
//
// Knob 1: Hue. Adds the knob to the hue of the metal, so one turn comes back to where it began. At 0 the kamacite is silver with a steel-blue cast (about 190, 215, 235) and the plessite is a grey-gold. At 0.2 the metal is a pale violet, at 0.45 a pale straw gold, at 0.6 a pale rose and at 0.8 a pale green; the taenite rims and the plessite turn with it and keep their dark and mid levels.
// Knob 2: Sweep. How fast the slab moves through the crystal and the tilt precesses, as (knob / 2) to the power 1.5 of the base rate. At 0 the crystal stands still and only the raking light moves; at 1 the plane moves 0.8 LED of crystal a second along its normal; at the opening 2 it moves 2.2 LEDs a second and the tilt makes a turn of its precession in about 130 s; at 3 it moves 4 LEDs a second.
// Knob 3: Plate. The plate spacing d, from 5 LEDs at -1 through 9.5 at the opening 0 to 18 at 1 (9.5 times 1.9 to the power of the knob). The whole crystal scales about the middle of the panel: the plate length (radius 1.4 to 3.2 spacings) and the width of the field it sits in scale with d, so at 5 the mosaic is fine and busy and at 18 a plate runs most of the panel's height.
// Knob 4: Cut. The tilt of the cut away from the cube face of the crystal, 55 degrees times ((knob + 1) / 2) to the power 1.2, which is 0 at -1, 26 degrees at the opening 0.06 and 55 at 1. At 0 the cut is a cube face and the four families fall into two directions at right angles, a field of diamonds with the plates of a pair side by side; tilted, the four directions part into triangles and diamonds. At about 55 degrees the plane comes near the octahedral planes of one family and that family fills wide areas.

// The crystal is the one a kamacite-taenite iron has: four families of plates lying in the
// planes normal to (1, 1, 1), (1, 1, -1), (1, -1, 1) and (-1, 1, 1). Each family is a stack of
// plates a spacing d apart, and each plate is a thin lens, not an infinite sheet: it lies in its
// own plane as an ellipse with a radius of a few d and is thickest at its centre, thinning to
// nothing at its rim. Nothing in the code is a picture of a plate. The picture is a slice.
//
// The panel is a plane through that crystal. LED (x, y) sits at the crystal point
//   r = o + (x - 32) u + (y - 64) v,
// with o the plane's origin and u, v its two orthonormal axes. For a family with unit normal n
// the signed height above its plates is s = n . r, and the plates sit at s = k + phase, in units
// of d. A smooth three-dimensional noise bends s a little, so the bands wave. For an LED only
// the nearest k can reach it, so one plate is tested per family per LED: its in-plane position
// (the two coordinates of r along the plate's own plane) picks a cell of a jittered grid that
// holds one lens of hashed radius and centre, and the LED is inside the plate where
// |s - plate| is less than the lens's half thickness there. The cut meets the plate where the
// two cross: where the cut runs steeply through the stack the plates are narrow bands, where it
// runs along them one plate fills wide areas, and as the plane passes the lens's edge the band
// tapers and vanishes. A band whose half width has fallen below an LED fades out together with
// its rim, so the picture has no one-LED lines.
//
// A plate is drawn as bright kamacite inside a dark taenite rim a little under two LEDs wide,
// on a plessite field of soft two-octave mottle, a value noise in LED coordinates of the crystal
// so it slides with the metal. Where plates of two families overlap, the later in the order
// 0, 1, 2, 3 is drawn over the earlier, as on a specimen where one family cuts across another.
// A raking light whose direction drifts shades the ridge: the in-plane gradient of s, unit length,
// dotted with the light gives which edge of a plate faces it, and that edge is lit with a thin
// bright line. The light moves on the real clock; the crystal moves on a clock the Sweep knob
// scales. Every angle is a sum of sines or a ramp at rates that no one divides into another, and
// the plane's origin integrates a velocity, so the slice never comes back. The origin grows
// without limit, but plates are found by integer indices of at most a few thousand and the
// noise by hashed lattice cells, so double precision holds for hours.

const W = 64, H = 128;
const { floor, sin, cos, sqrt, abs, max, min, round, pow, PI } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---- the crystal, in units of the plate spacing d
const SQ3 = 1 / sqrt(3), R2 = 1 / sqrt(2), R6 = 1 / sqrt(6);
const NRM = [[SQ3, SQ3, SQ3], [SQ3, SQ3, -SQ3], [SQ3, -SQ3, SQ3], [-SQ3, SQ3, SQ3]];
// Two unit vectors in each family's plane, normal to its normal and to each other.
const E1 = [[R2, -R2, 0], [R2, -R2, 0], [R2, R2, 0], [R2, R2, 0]];
const E2 = [[R6, R6, -2 * R6], [R6, R6, 2 * R6], [R6, -R6, -2 * R6], [R6, -R6, 2 * R6]];
const PH = [0.13, 0.41, 0.67, 0.89]; // where each family's plates sit, as a share of d
const JITTER = 0.15; // plate positions move this far either way from the regular stack, in d
const G = 7.4; // side of the grid of lenses in a plate's plane, in d
const RMIN = 2.3, RSPAN = 1.4; // lens radius from 2.3 to 3.7 d, so a lens always fits its cell
const EXIST = 232; // of 256: the share of cells that hold a plate
const HALF0 = 0.17, HALFSPAN = 0.08; // half thickness at a lens's centre, from 0.17 to 0.25 d
// Half thickness goes as the square root of (1 - r^2) across the lens, where r is 0 at its centre and 1 at its rim.
const WARP = 0.14; // how far the noise bends the bands, in d
const WARP_LEN = 3.4, THICK_LEN = 2.2; // wavelengths of the bending and of the thickness noise, in d
const RIM_PER_D = 0.15, RIM_MIN = 1.0, RIM_MAX = 1.8; // width of the taenite rim in LEDs: 0.15 d, between 1 and 1.8
const NK = 128; // plate indices kept for a family in a frame

// ---- the slab's motion
const SWEEP_BASE = 2.6; // LEDs of crystal a second along the normal at the opening
const TILT_MAX = 55 * PI / 180;

// ---- the coarse grid for the noise that bends the bands
const GX = 17, GY = 33, GSTEP = 4, NF = 5;
// ... and the grid for the plessite mottle, a node every 2 LEDs
const MX = 33, MY = 65;

// ---- the colours
const HUE0 = 0.58; // steel blue at Hue 0
function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  out[0] = rgb[0];
  out[1] = rgb[1];
  out[2] = rgb[2];
}

function hash3(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
const lat = (x, y, z) => (hash3(x, y, z) >>> 8) / 8388608 - 1;

// Smooth value noise in -1..1 on the integer lattice.
function noise3(x, y, z) {
  const ix = floor(x), iy = floor(y), iz = floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = lat(ix, iy, iz), b = lat(ix + 1, iy, iz), c = lat(ix, iy + 1, iz), d = lat(ix + 1, iy + 1, iz);
  const e = lat(ix, iy, iz + 1), f = lat(ix + 1, iy, iz + 1), g = lat(ix, iy + 1, iz + 1), h = lat(ix + 1, iy + 1, iz + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy;
  return y0 + (y1 - y0) * fz;
}

// Offsets that make the five coarse fields different from one another.
const NOFF = [[0, 0, 0], [31.7, 12.3, 5.9], [-17.2, 44.1, 23.6], [8.4, -29.5, 61.3], [52.9, 17.6, -38.2]];

export function setup(params) {
  const fam = (n) => new Float64Array(n);
  params.s = {
    ok: false, t: 0, tau: 0, hue: 0, spd: 1, d: 9.5, e: 0.47,
    oU: [3.7, 1.9, 5.3], oL: [3.7 * 9.5, 1.9 * 9.5, 5.3 * 9.5],
    u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1],
    lx: 1, ly: 0,
    fs0: fam(4), fsx: fam(4), fsy: fam(4), fg: fam(4), fm: fam(4), fr: fam(4),
    fa0: fam(4), fax: fam(4), fay: fam(4), fb0: fam(4), fbx: fam(4), fby: fam(4), kmin: new Int32Array(4),
    jit: new Float64Array(4 * NK), hp: new Int32Array(4 * NK), offA: new Float64Array(4 * NK), offB: new Float64Array(4 * NK),
    pb: new Float64Array(4 * NK),
    grid: new Float64Array(GX * GY * NF),
    mot: new Float64Array(MX * MY * 2),
    kam: [0, 0, 0], rim: [0, 0, 0], white: [0, 0, 0], gold: [0, 0, 0], grey: [0, 0, 0],
    c: [0, 0, 0],
  };
}

// The cut plane's frame at the crystal clock tau: a tilt of the cube face by an angle about a
// horizontal axis whose azimuth precesses (it comes back to a cube face when the tilt is 0, so
// the picture does not spin), then a slow roll in the plane.
function frame(S) {
  const tau = S.tau;
  const phi = 0.9 + 0.047 * tau + 0.6 * sin(0.0291 * tau + 0.4) + 0.25 * sin(0.0713 * tau + 2.1);
  const mul = 0.9 + 0.07 * sin(0.0377 * tau + 1.3) + 0.03 * sin(0.0911 * tau + 0.2);
  const th = S.e * TILT_MAX * mul;
  const roll = 0.35 * sin(0.0233 * tau + 2.0) + 0.2 * sin(0.0611 * tau + 0.5);
  const kx = cos(phi), ky = sin(phi), c = cos(th), sn = sin(th), omc = 1 - c;
  const ux = c + kx * kx * omc, uy = kx * ky * omc, uz = -ky * sn;
  const vx = kx * ky * omc, vy = c + ky * ky * omc, vz = kx * sn;
  const cr = cos(roll), sr = sin(roll);
  S.u = [ux * cr + vx * sr, uy * cr + vy * sr, uz * cr + vz * sr];
  S.v = [-ux * sr + vx * cr, -uy * sr + vy * cr, -uz * sr + vz * cr];
  S.w = [ky * sn, -kx * sn, c];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Everything a frame needs about the plane, the plates the panel can reach and the bending noise.
function prepare(S) {
  const { u, v, oU, d } = S;
  for (let i = 0; i < 4; i++) {
    const n = NRM[i], e1 = E1[i], e2 = E2[i];
    const sx = dot(n, u) / d, sy = dot(n, v) / d;
    S.fsx[i] = sx;
    S.fsy[i] = sy;
    S.fs0[i] = dot(n, oU) - 32 * sx - 64 * sy;
    const g = sqrt(sx * sx + sy * sy);
    S.fg[i] = g;
    S.fm[i] = g > 1e-6 ? (sx * S.lx + sy * S.ly) / g : 0;
    S.fr[i] = cl(RIM_PER_D * d, RIM_MIN, RIM_MAX) * (g > 0.004 ? g : 0.004);
    const ax = dot(e1, u) / d, ay = dot(e1, v) / d, bx = dot(e2, u) / d, by = dot(e2, v) / d;
    S.fax[i] = ax;
    S.fay[i] = ay;
    S.fa0[i] = dot(e1, oU) - 32 * ax - 64 * ay;
    S.fbx[i] = bx;
    S.fby[i] = by;
    S.fb0[i] = dot(e2, oU) - 32 * bx - 64 * by;
    // The plates whose planes the panel can reach.
    const s00 = S.fs0[i], sw = sx * W, sh = sy * H;
    const lo = s00 + min(0, sw) + min(0, sh), hi = s00 + max(0, sw) + max(0, sh);
    let k0 = floor(lo - WARP - PH[i]) - 1;
    const k1 = ceil2(hi + WARP - PH[i]) + 1;
    if (k1 - k0 >= NK) k0 = k1 - NK + 1;
    S.kmin[i] = k0;
    for (let k = k0; k <= k1; k++) {
      const ii = i * NK + (k - k0), hp = hash3(k, i * 31 + 7, 99991), hq = hash3(k, i * 31 + 8, 4242);
      S.hp[ii] = hp;
      S.jit[ii] = ((hp & 1023) / 1023 - 0.5) * 2 * JITTER;
      S.offA[ii] = (((hp >>> 10) & 1023) / 1023) * G;
      S.offB[ii] = (((hp >>> 20) & 1023) / 1023) * G;
      S.pb[ii] = (hq & 255) / 255;
    }
  }
  // The coarse fields: four bendings, one for each family, and a thickness.
  const gr = S.grid;
  for (let gy = 0; gy < GY; gy++)
    for (let gx = 0; gx < GX; gx++) {
      const X = (gx * GSTEP - 32) / d, Y = (gy * GSTEP - 64) / d;
      const qx = oU[0] + X * u[0] + Y * v[0], qy = oU[1] + X * u[1] + Y * v[1], qz = oU[2] + X * u[2] + Y * v[2];
      const base = (gy * GX + gx) * NF;
      for (let f = 0; f < NF; f++) {
        const L = f < 4 ? WARP_LEN : THICK_LEN, o = NOFF[f];
        gr[base + f] = noise3(qx / L + o[0], qy / L + o[1], qz / L + o[2]);
      }
    }
  // The mottle: two octaves of value noise in LED coordinates of the crystal, one node every 2 LEDs.
  // A pixel centre sits a quarter or three quarters of the way between nodes, so the weights are fixed.
  const oL = S.oL, mo = S.mot, tt = S.t, e0 = 0.3 * tt, e1 = -0.22 * tt, e2 = 0.17 * tt;
  for (let my = 0; my < MY; my++)
    for (let mx = 0; mx < MX; mx++) {
      const X = mx * 2 - 32, Y = my * 2 - 64;
      const rx = oL[0] + X * u[0] + Y * v[0] + e0, ry = oL[1] + X * u[1] + Y * v[1] + e1, rz = oL[2] + X * u[2] + Y * v[2] + e2;
      const n1 = noise3(rx / 2.4, ry / 2.4, rz / 2.4), n2 = noise3(rx / 4.2 + 9.1, ry / 4.2 - 4.7, rz / 4.2 + 2.3);
      const q = (my * MX + mx) * 2;
      mo[q] = 0.65 * n1 + 0.35 * n2;
      mo[q + 1] = n2;
    }
  // The colours.
  const h0 = HUE0 + S.hue;
  hsv(h0, 0.16, 1, S.kam);
  hsv(h0, 0.04, 1, S.white);
  // The warm tones turn with the metal but lose up to two thirds of their colour at the far side of the
  // wheel, so a tinted slab stays a metal and does not turn into a two-colour poster.
  const f = 1 - 0.32 * (1 - cos(2 * PI * S.hue));
  hsv(h0 - 0.47, 0.56 * f, 1, S.rim);
  hsv(h0 - 0.47, 0.32 * f, 1, S.gold);
  hsv(h0 - 0.47, 0.06 * f, 1, S.grey);
  for (let j = 0; j < 3; j++) S.white[j] = S.white[j] * 0.7 + 0.3;
  S.ok = true;
}
const ceil2 = (x) => -floor(-x);

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kn = input.knobValues || [0, 2, 0, 0.06], d0 = cl(dt || 0, 0, 0.1);
  S.hue = kn[0];
  S.spd = pow(cl(kn[1], 0, 3) / 2, 1.5);
  S.d = 9.5 * pow(1.9, cl(kn[2], -1, 1));
  S.e = pow((cl(kn[3], -1, 1) + 1) / 2, 1.2);
  // The slab moves along its normal and drifts a little in its own plane; the origin is kept in
  // units of d (it scales the mosaic about the panel's middle when Plate turns) and in LEDs
  // (which places the plessite mottle).
  if (!S.ok) {
    frame(S);
  }
  const ds = d0 * S.spd, tau = S.tau;
  S.t += d0;
  S.tau += ds;
  const dr = [0, 0, 0];
  const a = 0.45 * cos(0.0371 * tau + 1), b = 0.45 * sin(0.0477 * tau + 0.3);
  for (let j = 0; j < 3; j++) dr[j] = SWEEP_BASE * S.w[j] + a * S.u[j] + b * S.v[j];
  for (let j = 0; j < 3; j++) {
    S.oL[j] += dr[j] * ds;
    S.oU[j] += (dr[j] * ds) / S.d;
  }
  frame(S);
  const t = S.t, al = 0.2 * t + 0.4 * sin(0.231 * t + 0.7) + 0.2 * sin(0.0613 * t + 2.0);
  S.lx = cos(al);
  S.ly = sin(al);
  prepare(S);
}

const LR = new Float64Array(8), LG = new Float64Array(8), LB = new Float64Array(8), LA = new Float64Array(8);

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.ok) return;
  const { fs0, fsx, fsy, fg, fm, fr, fa0, fax, fay, fb0, fbx, fby, kmin, jit, hp, offA, offB, pb, grid } = S;
  const { kam, rim, white, gold, grey, mot: mo } = S;
  const invG = 1 / G, dt = cl((S.d - 5) / 13, 0, 1), fadeLo = 0.5 + 0.3 * dt, fadeHi = 1.0 + 0.4 * dt;
  for (let y = 0; y < H; y++) {
    const py = y + 0.5, gyf = py / GSTEP, jy = min(floor(gyf), GY - 2), fy = gyf - jy;
    for (let x = 0; x < W; x++) {
      const px = x + 0.5, gxf = px / GSTEP, jx = min(floor(gxf), GX - 2), fx = gxf - jx;
      const n00 = (jy * GX + jx) * NF, n10 = n00 + NF, n01 = n00 + GX * NF, n11 = n01 + NF;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const tm = 1 + 0.22 * (grid[n00 + 4] * w00 + grid[n10 + 4] * w10 + grid[n01 + 4] * w01 + grid[n11 + 4] * w11);
      let nl = 0, free = 1;
      for (let i = 0; i < 4; i++) {
        const warp = WARP * (grid[n00 + i] * w00 + grid[n10 + i] * w10 + grid[n01 + i] * w01 + grid[n11 + i] * w11);
        const s = fs0[i] + fsx[i] * px + fsy[i] * py + warp;
        const k = round(s - PH[i]), idx = k - kmin[i];
        if (idx < 0 || idx >= NK) continue;
        const ii = i * NK + idx;
        const dsg = s - (k + PH[i] + jit[ii]);
        const ads = dsg < 0 ? -dsg : dsg, g = fg[i], gg = g > 0.004 ? g : 0.004;
        if (ads > 0.34 * tm + fr[i] + gg) continue;
        const A = fa0[i] + fax[i] * px + fay[i] * py + offA[ii];
        const B = fb0[i] + fbx[i] * px + fby[i] * py + offB[ii];
        const ci = floor(A * invG), cj = floor(B * invG);
        const hc = hash3(hp[ii], ci, cj);
        if ((hc & 255) >= EXIST) continue;
        const hd = hash3(hc, 12345, 777);
        const Ra = RMIN + RSPAN * ((hd & 255) / 255), Rb = RMIN + RSPAN * (((hd >>> 8) & 255) / 255);
        const cx = (ci + 0.5) * G + (((hc >>> 8) & 255) / 127.5 - 1) * (G * 0.5 - Ra);
        const cy = (cj + 0.5) * G + (((hc >>> 16) & 255) / 127.5 - 1) * (G * 0.5 - Rb);
        const da = (A - cx) / Ra, db = (B - cy) / Rb, r2 = da * da + db * db;
        if (r2 >= 1) continue;
        const h = (HALF0 + HALFSPAN * (((hd >>> 16) & 255) / 255)) * tm * sqrt(1 - r2);
        // A band narrower than about two LEDs (a little more at a coarse spacing) fades out with its rim.
        let fade = (h / gg - fadeLo) / (fadeHi - fadeLo);
        if (fade <= 0) continue;
        if (fade > 1) fade = 1;
        fade = fade * fade * (3 - 2 * fade);
        const covR = cl((h + fr[i] - ads) / gg + 0.5, 0, 1) * fade;
        if (covR <= 0) continue;
        const covK = cl((h - ads) / gg + 0.5, 0, 1) * fade;
        const sgn = dsg < 0 ? -1 : 1, m = fm[i];
        // Taenite rim, a little brighter on the face the light reaches.
        const Lr = 0.42 + 0.06 * m * sgn;
        LR[nl] = rim[0] * Lr;
        LG[nl] = rim[1] * Lr;
        LB[nl] = rim[2] * Lr;
        LA[nl++] = covR;
        free *= 1 - covR;
        if (covK > 0) {
          const pc = cl(dsg / h, -1, 1);
          const Lk = 0.8 + 0.07 * pb[ii] + 0.2 * m * pc;
          const inL = (h - ads) / gg;
          let gl = 1 - abs(inL - 0.45) / 0.85;
          gl = gl > 0 ? gl * (0.28 + 0.72 * max(0, sgn * m)) * 0.9 : 0;
          LR[nl] = kam[0] * Lk + (white[0] - kam[0] * Lk) * gl;
          LG[nl] = kam[1] * Lk + (white[1] - kam[1] * Lk) * gl;
          LB[nl] = kam[2] * Lk + (white[2] - kam[2] * Lk) * gl;
          LA[nl++] = covK;
          free *= 1 - covK;
        }
      }
      // The plessite under all of it, computed only where it shows.
      let r, g2, b;
      if (free > 0.004) {
        const mx = x >> 1, my = y >> 1, ax = x & 1 ? 0.75 : 0.25, ay = y & 1 ? 0.75 : 0.25;
        const q0 = (my * MX + mx) * 2, q1 = q0 + 2, q2 = q0 + MX * 2, q3 = q2 + 2;
        const c00 = (1 - ax) * (1 - ay), c10 = ax * (1 - ay), c01 = (1 - ax) * ay, c11 = ax * ay;
        const mot = mo[q0] * c00 + mo[q1] * c10 + mo[q2] * c01 + mo[q3] * c11;
        const n2 = mo[q0 + 1] * c00 + mo[q1 + 1] * c10 + mo[q2 + 1] * c01 + mo[q3 + 1] * c11, gm = cl(0.5 + 0.9 * n2, 0, 1);
        const Lp = 0.52 + 0.14 * mot;
        r = (grey[0] + (gold[0] - grey[0]) * gm) * Lp;
        g2 = (grey[1] + (gold[1] - grey[1]) * gm) * Lp;
        b = (grey[2] + (gold[2] - grey[2]) * gm) * Lp;
      } else {
        r = gold[0] * 0.52;
        g2 = gold[1] * 0.52;
        b = gold[2] * 0.52;
      }
      for (let l = 0; l < nl; l++) {
        const a = LA[l];
        r += (LR[l] - r) * a;
        g2 += (LG[l] - g2) * a;
        b += (LB[l] - b) * a;
      }
      display.setPixel(x, y, round(255 * r), round(255 * g2), round(255 * b));
    }
  }
}
