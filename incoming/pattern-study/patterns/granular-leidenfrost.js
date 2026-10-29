// ===== Patternflow pattern =====
// Title:   Granular Leidenfrost
// Family:  particle
// Idea:    A tall box of inelastic grains four LEDs across stands on a floor that strikes every grain landing on it, and past a strength of shaking the grains part into a cold cluster packed as a crystal, some twenty layers of grains, floating on a thin hot gas of grains the floor keeps throwing up, the way a drop rides its own vapour on a hot plate; gentler shaking lets the cluster settle into a bed on the floor, harder shaking presses it to the lid, and more elastic grains melt it into gas.
// Author:  patternflow-lab
// Date:    2026-10-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: the granular Leidenfrost effect (Peter Eshuis, Ko van der Weele, Devaraj van der Meer and Detlef Lohse, "Granular Leidenfrost Effect: Experiment and Theory of Floating Particle Clusters", Physical Review Letters 95, 258001, 2005), named after the drop on a hot plate (Johann Gottlob Leidenfrost, 1756), pattern round 70
// Round:   70
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Shaking=0.5..3, Restitution=0.88..0.98, Grains=320..440
//
// Knob 1: Hue. Turns the colours round the wheel together. At 0 a cold grain is teal (27, 133, 179) and the hotter it is the further it turns, through violet to a pale pink (255, 128, 181) with a glow round the hottest; heat runs on a log scale from a grain moving at 1/18 of the floor's speed to one moving at it. At 0.25 cold is purple and hot pale yellow, at 0.5 cold is rust and hot mint, at 0.75 cold is green and hot lavender.
// Knob 2: Shaking. The floor's speed U is 52 LEDs a second times the knob, under a gravity of 40 LEDs a second squared, so U squared over g and a grain's width, the shaking strength, is 4 at 0.5, 68 at the opening 2 and 152 at 3. At 0.5 the grains lie as a bed on the floor 76 LEDs deep with only its bottom rows warm; at 2 the crystal's underside rides about 40 LEDs above the floor on the gas with its top near row 30; at 3 it floats from 60 LEDs up and is pressed toward the lid.
// Knob 3: Restitution. The share of their closing speed two grains keep when they collide, 0.88 at the opening. More elastic grains lose less inside the crystal, so it warms and rises: at 0.93 it floats from 64 to 116 LEDs up, and at 0.98 it melts into a gas that thins from the lid down, its top grains moving at a third of the floor's speed.
// Knob 4: Grains. 320 to 440 in tens, 20 to 27.5 layers of 16. A new count starts a fresh box with 85% of the grains packed in rows from 52 LEDs up and the rest scattered under them. A heavier crystal sinks onto a thinner gas: 440 grains float from 28 LEDs up and stand to 116.

const W = 64, H = 128;
const { floor, ceil, round, min, max, abs, sqrt, exp, log10 } = Math;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
  return out;
}

// Lengths in LEDs, time in the panel's seconds. z counts up from the floor,
// the top edge of the bottom row, to the lid, the top edge of row 0. Grains
// are hard disks of radius R, 16 to a layer across the 64 columns.
const ZTOP = H - 1, R = 2, D = 2 * R, NMAX = 440;
const GRAV = 40;
// The floor is a sawtooth driver in the limit of a small, fast stroke: it
// stays at z = 0 and always meets a grain moving up at U, so a grain
// landing at speed v leaves at U + E_FLOOR (U + v), with up to 15% of that
// impact turned sideways by the floor's roughness.
const U_PER = 52, E_FLOOR = 0.8, E_WALL = 0.9, ROUGH = 0.15;
// A substep is at most 1/240 s and short enough that the fastest grain
// moves at most 1.2 LEDs in it, under a third of its width.
const SUBSTEP = 1 / 240, REACH = 1.2;
// Grains are drawn a little smaller than they are, so a packed cluster
// shows as grains and not as a slab.
const RD = 1.6;

export function setup(params) {
  params.s = {
    n: 0, hue: 0, U: 0, e: 0.88,
    x: new Float32Array(NMAX), z: new Float32Array(NMAX), vx: new Float32Array(NMAX), vz: new Float32Array(NMAX),
    heat: new Float32Array(NMAX),
    head: new Int32Array(16 * 33), next: new Int32Array(NMAX),
    rgb: new Float32Array(W * H * 3), c: [0, 0, 0],
  };
  return params.s;
}

// A fresh box: 85% of the grains packed in staggered rows from 52 LEDs up,
// the rest scattered under them as a gas, so the first seconds already
// show a cluster settling onto its gas rather than a heap waking up.
function start(S, n) {
  S.n = n;
  const per = W / D;
  let i = 0;
  for (let r = 0; i < n * 0.85; r++)
    for (let c = 0; c < per && i < n; c++, i++) {
      S.x[i] = R + c * D + (r & 1 ? R * 0.5 : 0);
      S.z[i] = 52 + r * D * 0.9;
      S.vx[i] = (Math.random() - 0.5) * 4;
      S.vz[i] = 0;
    }
  for (; i < n; i++) {
    S.x[i] = R + Math.random() * (W - D);
    S.z[i] = R + Math.random() * 44;
    S.vx[i] = (Math.random() - 0.5) * 80;
    S.vz[i] = (Math.random() - 0.5) * 80;
  }
  S.heat.fill(0);
}

// One substep. Grains collide as hard disks with restitution e along the
// line of centres, found through a grid of cells one grain across; any
// overlap left is pushed apart along the same line.
function step(S, h) {
  const { x, z, vx, vz, head, next, n, U, e } = S;
  for (let i = 0; i < n; i++) {
    vz[i] -= GRAV * h;
    x[i] += vx[i] * h;
    z[i] += vz[i] * h;
    if (z[i] < R) {
      z[i] = R;
      const s = U - vz[i];
      if (s > 0) {
        vz[i] = U + E_FLOOR * s;
        vx[i] += (Math.random() - 0.5) * 2 * ROUGH * s;
      }
    } else if (z[i] > ZTOP - R) {
      z[i] = ZTOP - R;
      if (vz[i] > 0) vz[i] = -E_WALL * vz[i];
    }
    if (x[i] < R) (x[i] = R), (vx[i] = abs(vx[i]) * E_WALL);
    else if (x[i] > W - R) (x[i] = W - R), (vx[i] = -abs(vx[i]) * E_WALL);
  }
  const CW = W / D, CH = 33;
  head.fill(-1);
  for (let i = 0; i < n; i++) {
    const c = cl(floor(z[i] / D), 0, CH - 1) * CW + cl(floor(x[i] / D), 0, CW - 1);
    next[i] = head[c];
    head[c] = i;
  }
  for (let i = 0; i < n; i++) {
    const cx = cl(floor(x[i] / D), 0, CW - 1), cz = cl(floor(z[i] / D), 0, CH - 1);
    for (let gz = max(0, cz - 1); gz <= min(CH - 1, cz + 1); gz++)
      for (let gx = max(0, cx - 1); gx <= min(CW - 1, cx + 1); gx++)
        for (let j = head[gz * CW + gx]; j >= 0; j = next[j]) {
          if (j <= i) continue;
          const dx = x[j] - x[i], dz = z[j] - z[i], d2 = dx * dx + dz * dz;
          if (d2 >= D * D || d2 < 1e-9) continue;
          const d = sqrt(d2), nx = dx / d, nz = dz / d;
          const vn = (vx[j] - vx[i]) * nx + (vz[j] - vz[i]) * nz;
          if (vn < 0) {
            const J = (-(1 + e) * vn) / 2;
            vx[i] -= J * nx;
            vz[i] -= J * nz;
            vx[j] += J * nx;
            vz[j] += J * nz;
          }
          const o = (D - d) / 2;
          x[i] -= o * nx;
          z[i] -= o * nz;
          x[j] += o * nx;
          z[j] += o * nz;
        }
  }
}

export function update(dt, input, params) {
  const S = params.s || setup(params);
  const kv = input.knobValues || [0, 2, 0.88, 320], d = cl(dt || 0, 0, 0.1);
  S.hue = kv[0] || 0;
  S.U = U_PER * cl(kv[1] ?? 2, 0.5, 3);
  S.e = cl(kv[2] ?? 0.88, 0.88, 0.98);
  const n = round(cl(kv[3] ?? 320, 320, 440) / 10) * 10;
  if (n !== S.n) start(S, n);
  let vm = 0;
  for (let i = 0; i < S.n; i++) vm = max(vm, S.vx[i] * S.vx[i] + S.vz[i] * S.vz[i]);
  const sub = min(48, max(1, ceil(d / SUBSTEP), ceil((d * (sqrt(vm) + 3 * S.U)) / REACH)));
  for (let k = 0; k < sub; k++) step(S, d / sub);
  // Each grain's heat, its squared speed smoothed over 0.375 s.
  const a = 1 - exp(-d / 0.375);
  for (let i = 0; i < S.n; i++) S.heat[i] += a * (S.vx[i] * S.vx[i] + S.vz[i] * S.vz[i] - S.heat[i]);
}

export function draw(display, params) {
  const S = params.s;
  if (!S || !S.n) return;
  const rgb = S.rgb, c = S.c, U2 = S.U * S.U;
  rgb.fill(0);
  for (let i = 0; i < S.n; i++) {
    // Heat on a log scale against the floor's speed: 0 for a grain moving
    // at 1/18 of U or slower, 1 for one moving at U.
    const heat = cl(log10(max(1e-6, S.heat[i] / U2)) / 2.5 + 1, 0, 1);
    hsv(0.55 + S.hue + 0.38 * heat, 0.85 - 0.35 * heat, 1, c);
    const px = S.x[i], py = ZTOP - S.z[i], gl = 0.4 * heat * heat, rr = RD + (gl > 0.02 ? 3 : 0.6), body = 0.7 + 0.3 * heat;
    for (let y = max(0, floor(py - rr)); y <= min(H - 1, floor(py + rr)); y++)
      for (let x = max(0, floor(px - rr)); x <= min(W - 1, floor(px + rr)); x++) {
        const dd = sqrt((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2);
        const v = body * cl(RD + 0.5 - dd, 0, 1) + gl * exp(-max(0, dd - RD) / 1.4), o = (y * W + x) * 3;
        rgb[o] += c[0] * v;
        rgb[o + 1] += c[1] * v;
        rgb[o + 2] += c[2] * v;
      }
  }
  // The floor, the bottom row, brighter the faster it strikes.
  const fl = 0.25 + (0.2 * S.U) / (3 * U_PER);
  for (let x = 0, o = (H - 1) * W * 3; x < W; x++, o += 3) (rgb[o] += fl * 0.9), (rgb[o + 1] += fl * 0.9), (rgb[o + 2] += fl);
  for (let y = 0, o = 0; y < H; y++)
    for (let x = 0; x < W; x++, o += 3)
      display.setPixel(x, y, (255 * cl(rgb[o], 0, 1)) | 0, (255 * cl(rgb[o + 1], 0, 1)) | 0, (255 * cl(rgb[o + 2], 0, 1)) | 0);
}
