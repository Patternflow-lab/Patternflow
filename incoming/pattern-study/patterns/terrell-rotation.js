// ===== Patternflow pattern =====
// Title:   Terrell Rotation
// Family:  space
// Idea:    A sheet of cubes and spheres slides up past a pinhole camera at a share of light's speed, and each LED shows the light that left the sheet earlier and reaches the camera now, so the cubes look turned to show their undersides instead of squashed, the spheres keep round outlines while their nets swing round, and the colours shift towards blue below, where the light left parts coming on.
// Author:  patternflow-lab
// Date:    2026-10-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Terrell-Penrose rotation (James Terrell, 1959; Roger Penrose, 1959), after Anton Lampa (1924), pattern round 57
// Round:   57
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Beta=0..0.95, Distance=2..8
//
// Knob 1: Hue. The sheet's colour at rest, azure at 0, turned round the wheel. The Doppler shift moves each LED along the wheel from there by 0.12 times the log of the Doppler factor: towards violet where the light left a part coming towards the camera, towards green where it left a part going away.
// Knob 2: Speed. How fast the sheet slides on the panel, not its speed against light's: 0.45 times the knob in cells of the sheet's own length a second, 0.9 at 2, so a new row comes in about every 1.1 s whatever Beta is.
// Knob 3: Beta. The sheet's speed as a share of light's. At 0 the camera sees plain perspective. At 0.3 a cube seen straight out from the camera looks turned 17.5 degrees, at 0.6 36.9 and at 0.9 64.2, the arcsine of Beta, showing its trailing underside; the spheres stay round. The rows bunch up towards the top, and straight out the light arrives with the Doppler factor 1/gamma, 0.44 at 0.9.
// Knob 4: Distance. The camera's distance from the sheet, 2 to 8 cells, with the lens zoomed to keep three columns across the panel: it sees 54 degrees above and below the middle at 2, where the near rows bend, and 19 degrees at 8, where every cube is turned by nearly the same angle.

const W = 64, H = 128;
const { floor, min, max, abs, sqrt, acos, atan2, PI, round } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
// The sheet in its own rest frame, in cells: a cube or a sphere on every
// cell of a square grid in the plane z = D, chequered, cubes 0.5 on a side
// and spheres 0.68 across, so neither touches a neighbour.
const HC = 0.25, RS = 0.34, HM = 0.34;
// The net on each sphere: its pole looks back at the camera along -z,
// parallels every 30 degrees and six meridians.
const DPAR = PI / 6, DMER = PI / 3;

function hsv(h, s, v, out, o) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[o] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[o + 1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[o + 2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

export function setup(params) {
  params.s = {
    phi: 0, hue: 0, speed: 2, beta: 0, dist: 2, key: "",
    // Per LED: the ray in the sheet's frame (ex, ey, ez) and the Doppler
    // factor of light arriving along it.
    ray: new Float32Array(W * H * 4), rgb: new Float32Array(3),
  };
}

// One pixel is one direction at the camera. Light reaching the camera from
// camera-frame direction d (unit, y up the panel) left the sheet along the
// sheet-frame direction (dx, gamma (dy + beta), dz) / (gamma (1 + beta dy)):
// aberration, the whole of the effect. Emission point and arrival meet on a
// straight line in the sheet's frame, so a ray traced there from the
// camera's present place finds what the LED shows. 1 / (gamma (1 + beta dy))
// is the Doppler factor. Rays only change with Beta and the lens.
function aim(s) {
  const b = s.beta, g = 1 / sqrt(1 - b * b), F = 23 * s.dist, R = s.ray;
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 4) {
      const X = (x + 0.5 - 32) / F, A = (64 - y - 0.5) / F, n = 1 / sqrt(X * X + A * A + 1);
      const dy = A * n, k = 1 / (g * (1 + b * dy));
      R[o] = X * n * k;
      R[o + 1] = g * (dy + b) * k;
      R[o + 2] = n * k;
      R[o + 3] = k;
    }
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const s = params.s, kv = input.knobValues || [0, 2, 0, 2], d = cl(dt || 0, 0, 0.1);
  s.hue = cl(kv[0], 0, 1);
  s.speed = cl(kv[1], 0.2, 3);
  s.beta = cl(kv[2], 0, 0.95);
  s.dist = cl(kv[3], 2, 8);
  // phi is how far the camera has gone through the sheet, in the sheet's
  // own cells.
  s.phi += d * 0.45 * s.speed;
}

export function draw(display, params) {
  const s = params.s;
  if (!s) return;
  const key = s.beta.toFixed(4) + "/" + s.dist.toFixed(3);
  if (key !== s.key) aim(s), (s.key = key);
  const R = s.ray, D = s.dist, F = 23 * D, phi = s.phi % 2, out = s.rgb, h0 = 0.56 + s.hue;
  const z0 = D - HM, z1 = D + HM;

  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 4) {
      const ex = R[o], ey = R[o + 1], ez = R[o + 2], dop = R[o + 3];
      // The slab the sheet fills, and the cells the ray crosses inside it.
      const t0 = z0 / ez, t1 = z1 / ez;
      const ya = -phi + t0 * ey, yb = -phi + t1 * ey, xa = t0 * ex, xb = t1 * ex;
      const jlo = Math.ceil(min(ya, yb) - HM), jhi = floor(max(ya, yb) + HM);
      const clo = max(-2, Math.ceil(min(xa, xb) - HM)), chi = min(2, floor(max(xa, xb) + HM));
      let best = 1e9, kind = 0, bj = 0, bc = 0, axis = 0;
      for (let j = jlo; j <= jhi; j++)
        for (let c = clo; c <= chi; c++) {
          // Local ray origin: the camera relative to this cell's centre.
          const ox = -c, oy = -phi - j, oz = -D;
          if (((j + c) & 1) === 0) {
            // A cube, by slabs.
            let tn = -1e9, tf = 1e9, ax = 0;
            const ix = 1 / ex, iy = 1 / ey;
            let a = (-HC - ox) * ix, b2 = (HC - ox) * ix;
            if (a > b2) [a, b2] = [b2, a];
            if (a > tn) (tn = a), (ax = 0);
            if (b2 < tf) tf = b2;
            a = (-HC - oy) * iy;
            b2 = (HC - oy) * iy;
            if (a > b2) [a, b2] = [b2, a];
            if (a > tn) (tn = a), (ax = 1);
            if (b2 < tf) tf = b2;
            a = (-HC - oz) / ez;
            b2 = (HC - oz) / ez;
            if (a > tn) (tn = a), (ax = 2);
            if (b2 < tf) tf = b2;
            if (tn <= tf && tn > 0 && tn < best) (best = tn), (kind = 1), (bj = j), (bc = c), (axis = ax);
          } else {
            const b2 = ox * ex + oy * ey + oz * ez, cc = ox * ox + oy * oy + oz * oz - RS * RS, disc = b2 * b2 - cc;
            if (disc <= 0) continue;
            const t = -b2 - sqrt(disc);
            if (t > 0 && t < best) (best = t), (kind = 2), (bj = j), (bc = c);
          }
        }
      if (!kind) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      const px = best * ex - bc, py = best * ey - phi - bj, pz = best * ez - D;
      // The size of one LED on the surface, in cells: Z / F across, and a
      // Doppler factor shorter along the motion, then stretched where the
      // surface is seen edge on.
      const foot = (best * ez) / (F * sqrt(dop));
      let fill, line;
      if (kind === 1) {
        const ea = axis === 0 ? abs(ex) : axis === 1 ? abs(ey) : ez;
        const u = axis === 0 ? max(abs(py), abs(pz)) : axis === 1 ? max(abs(px), abs(pz)) : max(abs(px), abs(py));
        const L = (foot * ez) / max(0.22, ea);
        line = cl(1.15 - (HC - u) / L, 0, 1);
        // The face towards the camera's side is brightest, the rows' tops and
        // bottoms next, the sides dimmest.
        fill = axis === 2 ? 0.17 : axis === 1 ? 0.12 : 0.085;
      } else {
        const mx = px / RS, my = py / RS, mz = pz / RS;
        const facing = -(mx * ex + my * ey + mz * ez);
        const th = acos(cl(-mz, -1, 1)), ps = atan2(my, mx);
        const dp = RS * abs(th - round(th / DPAR) * DPAR), dm = RS * Math.sin(th) * abs(ps - round(ps / DMER) * DMER);
        const L = foot / max(0.25, facing);
        line = max(cl(1.1 - dp / L, 0, 1), cl(1.1 - dm / L, 0, 1) * cl(th * 3, 0, 1));
        // The pole itself, and the rim where the ray grazes the outline.
        if (th < 0.2) line = 1;
        const rim = (1 - facing) * (1 - facing);
        line = max(line, rim * rim * 1.4);
        fill = 0.06 + 0.1 * facing;
      }
      // Doppler: hue along the wheel by 0.12 times the log of the factor, blue
      // for light from parts coming on, held short of yellow, which reads olive
      // when dim; and brightness by a softened searchlight, the
      // factor to the power 0.6 where the true intensity goes as its cube.
      const ld = Math.log(dop);
      const bright = cl(Math.exp(0.6 * ld), 0.5, 1.35);
      const v = min(1, (fill + (0.95 - fill) * line) * bright);
      hsv(h0 + cl(0.12 * ld, -0.24, 0.16), 0.85 - 0.4 * line, v, out, 0);
      display.setPixel(x, y, round(out[0] * 255), round(out[1] * 255), round(out[2] * 255));
    }
}
