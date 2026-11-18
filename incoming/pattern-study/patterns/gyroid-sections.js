// ===== Patternflow pattern =====
// Title:   Gyroid Sections
// Family:  space
// Idea:    A plane glides through the gyroid and cuts it, the two interwoven labyrinths that the minimal surface leaves on either side of itself filling the panel in two colours, the wall between them cut pale and the plane looking down each labyrinth to the wall it ends on, lit from one side and darkening with depth, while the plane's normal swings by itself from the cube axis [001] through the three-fold diagonal [111] to the face diagonal [110].
// Author:  patternflow-lab
// Date:    2026-11-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Gyroid (Alan Schoen, 1970, NASA report, from memory), a triply periodic minimal surface drawn here by its usual level set cos x sin y + cos y sin z + cos z sin x = t, which is not the exact surface; pattern round 113
// Round:   113
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Speed=0.2..3, Cut=-1..1, Wall=0..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 one labyrinth is teal, the other is rose and the wall the plane cuts is pale gold; at 0.5 they are red, sea green and pale blue.
// Knob 2: Speed. At 2 the plane flies along the body diagonal [111] at 0.45 units a second, a unit being 1/(2 pi) of the cell's side. The lattice repeats every pi x sqrt 3 = 5.44 units along that diagonal, so at [111] the section comes back to itself every 12.1 s, and the normal takes 36 s to swing through [111], [001], [111], [110] and back to [111]. 0.2 is ten times slower and 3 half as fast again.
// Knob 3: Cut. A hand on the plane's normal. Within 0.05 of 0, where it opens, the normal swings by itself and holds each named direction for a few seconds, with its Miller digits in the corner: 4.7 s of every 36 on [001], 9.7 s on [111] and 5.0 s on [110]. Past 0.05 the normal goes to [111] at 0.05 and on to [110] at 1, or from [111] to [001] at -1, and stays. A section square to [001] is a row of wavy bands, one square to [110] is a field of rings, and one square to [111] has three-fold symmetry about the centre of the panel.
// Knob 4: Wall. How thick the wall between the labyrinths is. The wall is the set where the level function is within t of 0, with t = 0.03 + 0.87 Wall^0.75. At the opening 0.06, t = 0.135 and the wall is 8.8% of the volume, each labyrinth 45.6%; at 0 it is a thin sheet of 2.0%, and at 1 a fat network of 59.0% whose labyrinths are only 20.5% each.

const W = 64, H = 128, N = W * H;
const { floor, min, max, abs, exp, sqrt, sin, cos, PI, atan } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => ((v = cl(v, 0, 1)), v * v * (3 - 2 * v));
const mix = (a, b, f) => a + (b - a) * f;

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

// The digits of the named directions, 3 wide and 5 tall, from edit-distance.js.
const FACE = { 0: "###|#.#|#.#|#.#|###", 1: ".#.|##.|.#.|.#.|###" };
for (const ch of Object.keys(FACE)) FACE[ch] = FACE[ch].replace(/\|/g, "").split("").map((c) => c === "#");

const SC = 0.2; // units a LED
const STEP = 0.22; // units a step of a ray
const DEEP = 6; // units, how far a ray looks before it gives up
const NSTEP = floor(DEEP / STEP);
const T111 = atan(sqrt(2)); // angle from [001] to [111], 54.7356 degrees
const T110 = PI / 2;
const SWING = 9; // seconds a leg of the swing takes at Speed 2
const BETA = 0.3; // how far the view leans from the normal, radians
const GLIDE = 0.45; // units a second at Speed 2

export function setup(params) {
  params.s = {
    rgb: new Float32Array(N * 3),
    cA: [0, 0, 0], cB: [0, 0, 0], cW: [0, 0, 0],
    tau: -1, ph: 0, c: 0, hue: 0, speed: 2, cut: 0, wall: 0.06,
  };
}

// The swing: [111] to [001], back, on to [110] and back, each leg held at both ends then eased.
function autoTau(ph) {
  const leg = floor(ph) % 4, s = ph - floor(ph);
  const a = [T111, 0, T111, T110][leg], b = [0, T111, T110, T111][leg];
  return mix(a, b, sm((s - 0.2) / 0.6));
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, kv = input.knobValues || [0, 2, 0, 0.06], d = cl(dt || 0, 0, 0.1);
  S.hue = cl(kv[0], 0, 1);
  S.speed = cl(kv[1], 0.2, 3);
  S.cut = cl(kv[2], -1, 1);
  S.wall = cl(kv[3], 0, 1);
  const g = (d * S.speed) / 2;
  S.c += g;
  S.ph += g / SWING;
  let target = autoTau(S.ph);
  if (abs(S.cut) > 0.05) target = T111 + (S.cut > 0 ? T110 - T111 : -T111) * ((abs(S.cut) - 0.05) / 0.95);
  S.tau = S.tau < 0 ? target : S.tau + (target - S.tau) * (1 - exp(-d * 8));
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const rgb = S.rgb, { cA, cB, cW } = S;
  hsv(0.49 + S.hue, 0.8, 1, cA);
  hsv(0.93 + S.hue, 0.72, 1, cB);
  hsv(0.11 + S.hue, 0.28, 1, cW);
  const T = 0.03 + 0.87 * Math.pow(S.wall, 0.75);
  const tau = S.tau < 0 ? T111 : S.tau, ca = cos(tau), sa = sin(tau), r2 = 1 / sqrt(2);
  // The plane's frame: normal n, and e1, e2 across the panel, the cube turned by tau about (-1, 1, 0).
  const n = [sa * r2, sa * r2, ca];
  const e1 = [(1 + ca) / 2, -(1 - ca) / 2, -sa * r2];
  const e2 = [-(1 - ca) / 2, (1 + ca) / 2, -sa * r2];
  // The plane's centre drifts along [111].
  const along = (GLIDE * S.c) / sqrt(3);
  const px = along, py = along, pz = along;
  // A ray goes into the crystal along -n, leaned toward e1.
  const sb = sin(BETA), cb = cos(BETA);
  const vx = -n[0] * cb + e1[0] * sb, vy = -n[1] * cb + e1[1] * sb, vz = -n[2] * cb + e1[2] * sb;
  const dx = STEP * vx, dy = STEP * vy, dz = STEP * vz;
  const cdx = cos(dx), sdx = sin(dx), cdy = cos(dy), sdy = sin(dy), cdz = cos(dz), sdz = sin(dz);
  // The light, in the plane's frame: from the upper left and the front.
  let lx = -0.5 * e1[0] - 0.55 * e2[0] + 0.8 * n[0], ly = -0.5 * e1[1] - 0.55 * e2[1] + 0.8 * n[1], lz = -0.5 * e1[2] - 0.55 * e2[2] + 0.8 * n[2];
  const ll = sqrt(lx * lx + ly * ly + lz * lz);
  lx /= ll; ly /= ll; lz /= ll;
  const pn = 1 / SC;

  for (let y = 0, o = 0; y < H; y++) {
    const vv = (y + 0.5 - 64) * SC;
    for (let x = 0; x < W; x++, o += 3) {
      const uu = (x + 0.5 - 32) * SC;
      const X = px + uu * e1[0] + vv * e2[0], Y = py + uu * e1[1] + vv * e2[1], Z = pz + uu * e1[2] + vv * e2[2];
      let cx = cos(X), sx = sin(X), cy = cos(Y), sy = sin(Y), cz = cos(Z), sz = sin(Z);
      const f0 = cx * sy + cy * sz + cz * sx;
      // Distance to the wall edge measured in the plane, for the cut's soft edge.
      const gx = cz * cx - sx * sy, gy = cx * cy - sy * sz, gz = cy * cz - sz * sx;
      const gn = gx * n[0] + gy * n[1] + gz * n[2];
      const gp = sqrt(max(1e-4, gx * gx + gy * gy + gz * gz - gn * gn));
      const dEdge = (abs(f0) - T) / gp;
      const cov0 = cl(0.5 - dEdge * pn, 0, 1), wallCov = 1 - (1 - cov0) * (1 - cov0);
      let r = 0, gC = 0, b = 0;
      if (wallCov < 1) {
        const sgn = f0 > 0 ? 1 : -1, base = sgn > 0 ? cA : cB;
        // March into the crystal until the wall at |f| = T is reached.
        let fPrev = sgn * f0, hit = -1;
        for (let k = 1; k <= NSTEP; k++) {
          let t2 = cx * cdx - sx * sdx; sx = sx * cdx + cx * sdx; cx = t2;
          t2 = cy * cdy - sy * sdy; sy = sy * cdy + cy * sdy; cy = t2;
          t2 = cz * cdz - sz * sdz; sz = sz * cdz + cz * sdz; cz = t2;
          const fv = sgn * (cx * sy + cy * sz + cz * sx);
          if (fv <= T) {
            hit = (k - 1 + (fPrev - T) / (fPrev - fv)) * STEP;
            break;
          }
          fPrev = fv;
        }
        let lum = 0.14;
        if (hit >= 0) {
          const qx = X + hit * vx, qy = Y + hit * vy, qz = Z + hit * vz;
          const c1 = cos(qx), s1 = sin(qx), c2 = cos(qy), s2 = sin(qy), c3 = cos(qz), s3 = sin(qz);
          let hx = c3 * c1 - s1 * s2, hy = c1 * c2 - s2 * s3, hz = c2 * c3 - s3 * s1;
          const hl = sgn / sqrt(hx * hx + hy * hy + hz * hz + 1e-9);
          hx *= hl; hy *= hl; hz *= hl;
          const lam = max(0, hx * lx + hy * ly + hz * lz);
          lum = (0.2 + 0.8 * lam) * (0.2 + 0.8 * exp(-hit / 2.6));
        }
        const k = 1 - wallCov;
        r = base[0] * lum * k; gC = base[1] * lum * k; b = base[2] * lum * k;
      }
      if (wallCov > 0) {
        const q = cl(abs(f0) / T, 0, 1), sheen = 0.58 + 0.42 * (1 - q * q);
        r += cW[0] * sheen * wallCov; gC += cW[1] * sheen * wallCov; b += cW[2] * sheen * wallCov;
      }
      rgb[o] = r; rgb[o + 1] = gC; rgb[o + 2] = b;
    }
  }
  // The named directions, in the corner, while the normal is on one of them.
  const tauNow = S.tau < 0 ? T111 : S.tau, deg = (tauNow * 180) / PI;
  for (let k = 0; k < 3; k++) {
    const dev = abs(deg - [0, T111 * 180 / PI, 90][k]), al = sm((1.6 - dev) / 1.2);
    if (al <= 0) continue;
    for (let y = 119; y < 128; y++)
      for (let x = 0; x < 15; x++) {
        const o = (y * W + x) * 3, keep = 1 - 0.8 * al;
        rgb[o] *= keep; rgb[o + 1] *= keep; rgb[o + 2] *= keep;
      }
    const word = ["001", "111", "110"][k];
    for (let i = 0; i < 3; i++) {
      const G = FACE[word[i]];
      for (let j = 0; j < 5; j++)
        for (let c = 0; c < 3; c++)
          if (G[j * 3 + c]) {
            const o = ((121 + j) * W + 2 + i * 4 + c) * 3;
            for (let e = 0; e < 3; e++) rgb[o + e] += (cW[e] - rgb[o + e]) * al;
          }
    }
  }
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3) display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
