// ===== Patternflow pattern =====
// Title:   Wulff Habit
// Family:  wulff
// Idea:    One tall faceted crystal, the intersection of 34 half-spaces whose distances from the centre are its surface energies, stands in a dark indigo room and sways, while the energies drift so that its prism faces, pyramid faces, corner cuts and cap trade area, thin to nothing and open again, and the crystal passes through needle, truncated prism, bipyramid and tablet without ever repeating, lit as a gem with bright edges and a glow from within.
// Author:  patternflow-lab
// Date:    2026-11-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// Lineage: Georg Wulff, "Zur Frage der Geschwindigkeit des Wachsthums und der Auflosung der Krystallflachen" (1901), the equilibrium shape of a crystal as the inner envelope of planes at distances proportional to their surface energies; J. Willard Gibbs's surface-energy minimum (1878); Pierre Curie's version of it (1885); the Herring construction for the general case (1951); pattern round 217
// Round:   219
// ===============================
// @matrix 64x128
// @knobs Hue=0..1, Elongation=0..3, Truncation=-1..1, Sway=-1..1
//
// Knob 1: Hue. Turns every colour round the wheel together. At 0 the four prism faces are gold turning to orange, the four 45 degree prism faces rose, the caps cyan, the {101} pyramid faces violet, the {111} faces lavender and the {201} faces blue, the edges warm white; at 0.5 the prism is blue, the cut prism faces sea green, the caps red, the {101} faces green and the {201} faces amber. The indigo ground only leans between azure and violet whatever the knob says, so it never turns brown.
// Knob 2: Elongation. The axial ratio c/a and the length together, from 0 to 3. A number E between 0 and 1 is K / 3 plus up to 0.45 of drift, passed through a smooth S so it never sits on a limit; c/a is (1.15 + 0.85 E) with up to 28 percent of drift, so the pyramid faces tilt between 50 and 21 degrees off the horizontal, and the half length of the crystal is (1.7 + 1.9 E) half widths plus up to 0.6 of drift. At 0 the crystal is a stubby bipyramid or a tablet, 32 to 49 LEDs wide and 44 to 105 tall; at 2, where it opens, it runs from a short truncated prism to a long one, 27 to 46 wide and 73 to 113 tall; at 3 it is a needle, 24 to 44 wide and 93 to 114 tall.
// Knob 3: Truncation. The energy of the secondary families, from -1 to 1. The {110} faces sit at 1.414 t times the {100} distance, with t = 1 - 0.3 T and T from 0.12 to 1, so at 1 they are as wide as the prism's own faces (t = 0.707 would be a regular octagon) and at -1 they are slivers; the {111} faces start between 0.07 and 0.36 y + 0.18 below where the {101} pyramid meets the prism (y is the half length of the prism), so they run from small triangles on the corners to long facets that take the whole edge; the {201} faces start between 0.2 and 0.24 y + 0.12 below it, and never take more than three quarters of the termination from the {101} faces. The knob moves the middle of each family's drift and the drift goes on round it, so no setting holds still.
// Knob 4: Sway. How far and how fast the crystal turns on its vertical axis and nods, from -1 to 1. The swing is 8 degrees at -1, 18.6 at 0.06 where it opens and 28 at 1, on four sines of 13.7, 23.9, 57.1 and 97.3 s sped up by 0.6 to 1.5 times by the knob, and the tilt towards the viewer is 12 degrees at -1 and 19.5 at 1 with a nod of 1.5 to 3 degrees on 9.7 and 15.9 s. A turning crystal shows more or fewer of its faces, foreshortens them, and moves every glint.

// What the picture is. A crystal in equilibrium takes the shape that minimises its total surface energy, the sum of each face's area times its energy
// per unit area, at fixed volume. Wulff's answer is a construction: draw from one centre a plane at distance h_i from the centre for each face
// direction n_i, with h_i proportional to its energy, and the crystal is the region inside all of them,
//   { x : n_i . x <= h_i for all i }.
// A face whose h is large lies outside the others and does not exist, and a small drop in h can open it as a sliver that grows to take the whole edge.
// Here the 34 normals are those of a tetragonal crystal with a vertical c axis: 4 prism faces {100}, 4 prism faces {110} at 45 degrees, 2 caps {001},
// 8 pyramid faces {101}, 8 {111} and 8 {201}. The vertical part of a pyramid normal is s = a / c, so a larger c/a makes every termination steeper.
// The distances are set through where the faces meet the prism, which says directly what the crystal looks like. The {101} faces meet the prism faces at
// height y, so h = (1 + s y) / sqrt(1 + s^2); the {201} faces meet them lower, at y - d3, h = (2 + s (y - d3)) / sqrt(4 + s^2), and take the band from
// there to y + d3 before the {101} faces go on; the {111} faces meet the corner edge at y - d2 and cut a diamond centred on the junction;
// the cap is at y + kappa / s, and the {110} faces cut the prism corner at h = 1.414 t. Each of these is a sum of sines, and each face's own distance
// carries a wobble of up to 3.8 percent on two sines of its own, so the faces never settle.
// The ratios ride on sums of two or three sines with periods between 30 and 140 s that do not divide each other, as does the size of the whole crystal,
// 0.85 to 1 of what fits the panel. Every distance is positive and the caps close the top and the bottom, so the origin is always inside and the solid
// is always closed and convex. Over 900 s at the opening, at both ends of every knob and at a few places between, 10 or more faces of 5 LEDs or more
// were on show, except for a moment or two in a corner of the knobs where 9 were.
// The picture. The view is orthographic. In the panel's frame the crystal is turned about its vertical axis by the sway angle and tilted towards the
// viewer by 12 to 20 degrees, so each plane has a world normal w_i and the ray of the pixel (px, py) runs along -z with z = -t. By the slab method it
// enters through the plane with the largest t among those that face it, t_i = (px wx + py wy - h_i) / wz, and leaves through the smallest among those
// that face away, so one pass over the planes gives the entry face, the exit face, the second best of each and the path length, no mesh, no sorting.
// The ray is inside the solid where tExit - tEnter > 0. Near the outline that is counted again on 3 by 3 rays, which gives the soft edge. The
// difference of the two best entries, divided by the length of its gradient on the screen, is the distance in LEDs to the edge between two faces, and the
// same on the two best exits gives the edges of the back faces seen through the glass, drawn faint.
// Each face takes a tint from its family, Lambert light from a warm point key and a cool fill, a Fresnel rim, and a glint from the key in a half vector that
// changes across the face, so a glint slides over a face and goes out on the next one as the crystal sways. The key walks once round the crystal in
// 383 s. Where the path through the crystal is long it glows from within, by 1 - exp(-length / 26 LEDs), in the colour of the face it shines out through,
// and the gauge max_i (n_i . x / h_i) at the middle of the ray is drawn at two levels, faint nested copies of the crystal like growth zones. The
// edges are bright, the outline has a bright rim, and the ground is indigo with a faint halo.

const W = 64, H = 128, NP = 34;
const { sin, cos, sqrt, exp, abs, min, max, floor, PI } = Math;
const TAU = 2 * PI;
const DEG = PI / 180;
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, v) => {
  const t = cl((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, u) => a + (b - a) * u;
const sg = (x) => 1 / (1 + exp(-5 * (x - 0.5))); // a smooth stand-in for a clamp to 0..1, so a drift never sits on its limit

// a sum of sines, [period s, weight, phase, ...], scaled to -1..1
function dr(t, L) {
  let s = 0, w = 0;
  for (let i = 0; i < L.length; i += 3) {
    s += L[i + 1] * sin((TAU * t) / L[i] + L[i + 2]);
    w += L[i + 1];
  }
  return s / w;
}
const D_E = [71.3, 1, 0.7, 109.7, 0.8, 2.4, 43.9, 0.45, 4.1];
const D_T110 = [53.1, 1, 2.0, 97.9, 0.9, 0.3, 37.7, 0.5, 5.0];
const D_T111 = [67.7, 1, 4.4, 131.3, 0.8, 1.2, 33.1, 0.4, 2.8];
const D_P = [89.3, 1, 1.7, 47.9, 0.6, 3.9, 139.1, 0.7, 0.2];
const D_C = [41.3, 1, 5.4, 83.9, 0.9, 2.2, 117.7, 0.7, 3.3];
const D_201 = [59.9, 1, 0.9, 101.3, 0.8, 4.6, 36.1, 0.35, 1.6];
const D_SZ = [73.7, 1, 3.1, 127.9, 0.8, 0.6, 35.3, 0.4, 2.0];
const D_ZG = [91.7, 1, 1.1, 57.3, 0.7, 3.7];

// the 34 planes: family, the horizontal part of the lattice vector, and the sign of the vertical part
// families: 0 {100}, 1 {110}, 2 {001}, 3 {101}, 4 {111}, 5 {201}
const FAM = new Uint8Array(NP), HX = new Float64Array(NP), HZ = new Float64Array(NP), VS = new Float64Array(NP);
{
  let n = 0;
  const add = (f, hx, hz, vs) => ((FAM[n] = f), (HX[n] = hx), (HZ[n] = hz), (VS[n] = vs), n++);
  add(0, 1, 0, 0); add(0, -1, 0, 0); add(0, 0, 1, 0); add(0, 0, -1, 0);
  add(1, 1, 1, 0); add(1, 1, -1, 0); add(1, -1, 1, 0); add(1, -1, -1, 0);
  add(2, 0, 0, 1); add(2, 0, 0, -1);
  for (const sy of [1, -1]) {
    add(3, 1, 0, sy); add(3, -1, 0, sy); add(3, 0, 1, sy); add(3, 0, -1, sy);
  }
  for (const sy of [1, -1]) {
    add(4, 1, 1, sy); add(4, 1, -1, sy); add(4, -1, 1, sy); add(4, -1, -1, sy);
  }
  for (const sy of [1, -1]) {
    add(5, 2, 0, sy); add(5, -2, 0, sy); add(5, 0, 2, sy); add(5, 0, -2, sy);
  }
}
// the hue of each family at knob 1 = 0: amber, rose, cyan, violet, lavender, blue
const FHUE = [0.1, 0.955, 0.5, 0.8, 0.715, 0.625];
const FSAT = [0.82, 0.62, 0.66, 0.74, 0.5, 0.8];

function hsv(h, s, v, out) {
  h = (h - floor(h)) * 6;
  const i = floor(h) % 6, f = h - floor(h), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  out[0] = i === 0 || i === 5 ? v : i === 1 ? q : i === 4 ? t : p;
  out[1] = i === 1 || i === 2 ? v : i === 0 ? t : i === 3 ? q : p;
  out[2] = i === 3 || i === 4 ? v : i === 2 ? t : i === 5 ? q : p;
}

function makeState() {
  const wf = new Float64Array(NP * 4);
  for (let i = 0; i < NP; i++) {
    wf[i * 4] = TAU / (23 + 74 * Math.random());
    wf[i * 4 + 1] = TAU * Math.random();
    wf[i * 4 + 2] = TAU / (29 + 71 * Math.random());
    wf[i * 4 + 3] = TAU * Math.random();
  }
  return {
    t: 0, ready: false, kn: [0, 2, 0, 0.06],
    ph: new Float64Array([1.0, 0.7, 4.1, 1.0, 3.3, 1.3]),
    wf,
    h: new Float64Array(NP), nx: new Float64Array(NP), ny: new Float64Array(NP), nz: new Float64Array(NP),
    // world normals, tint and light per plane
    wx: new Float64Array(NP), wy: new Float64Array(NP), wz: new Float64Array(NP),
    tr: new Float64Array(NP), tg: new Float64Array(NP), tb: new Float64Array(NP),
    fr: new Float64Array(NP), d2: new Float64Array(NP),
    zx: new Float64Array(NP), zy: new Float64Array(NP), zz: new Float64Array(NP),
    // plane tables for the slab pass, the planes facing the viewer and those facing away
    ne: 0, ea: new Float64Array(NP), eb: new Float64Array(NP), ec: new Float64Array(NP), ei: new Int32Array(NP),
    nx2: 0, xa: new Float64Array(NP), xb: new Float64Array(NP), xc: new Float64Array(NP), xi: new Int32Array(NP),
    rowE: new Float64Array(NP), rowX: new Float64Array(NP),
    cnt: new Int32Array(NP), nfaces: 0,
    px: new Float64Array(80), pz: new Float64Array(80), qx: new Float64Array(80), qz: new Float64Array(80),
    kx: -52, ky: 74, kz: 88, ki: 1, gl: 1, ox: 32, oy: 64, scale: 20, Rlat: 1.2, L: 2.5, yaw: 0, tilt: 0.28, size: 1, E: 0.67,
    hx: new Float64Array(W), hy: new Float64Array(H), gcol: [0, 0, 0],
    tmp: [0, 0, 0],
  };
}

export function setup(params) {
  params.s = makeState();
}

export function update(dt, input, params) {
  if (!params.s) setup(params);
  const S = params.s, d = cl(dt || 0, 0, 0.1);
  const kn = input.knobValues || [0, 2, 0, 0.06];
  const a = S.ready ? 1 - exp(-d / 0.35) : 1;
  S.kn[0] = cl(kn[0], 0, 1);
  for (let i = 1; i < 4; i++) {
    const target = cl(kn[i], i === 1 ? 0 : -1, i === 1 ? 3 : 1);
    S.kn[i] = S.ready ? S.kn[i] + (target - S.kn[i]) * a : target;
  }
  S.ready = true;
  const t = (S.t += d);
  const k1 = S.kn[0], k2 = S.kn[1], k3 = S.kn[2], u = 0.5 + 0.5 * S.kn[3]; // u 0..1 is the sway knob

  // ---- the habit: the family ratios, each on its own sines
  // Each pyramid family is set where its faces meet the prism: y1 for {101}, y3 for {201} on the face, y2 for {111} on the corner edge
  const E = sg(k2 / 3 + 0.45 * dr(t, D_E));
  S.E = E;
  const rho = (1.15 + 0.85 * E) * (1 + 0.28 * dr(t, D_P)); // c / a
  const s = 1 / rho; // the vertical part of a pyramid normal
  const kap = cl(0.38 + 0.6 * (0.5 + 0.5 * dr(t, D_C)), 0.38, 0.97); // the cap cuts the pyramid at this part of its height
  // the half length of the crystal is set first, so that it is never much longer than 3.5 times its half width, and the prism takes what the terminations leave
  const Lt = 1.7 + 1.9 * E + 0.6 * dr(t, D_ZG);
  const y1 = max(0.25, Lt - kap * rho); // the half length of the prism
  const hc = y1 + kap / s;
  const T110 = 0.12 + 0.88 * sg(0.58 + 0.45 * dr(t, D_T110) + 0.4 * k3);
  const T111 = sg(0.5 + 0.45 * dr(t, D_T111) + 0.42 * k3);
  const T201 = sg(0.5 + 0.45 * dr(t, D_201) + 0.2 * k3);
  const tr = lerp(1.0, 0.7, T110);
  // how far below y1 the {111} and {201} faces start: the {111} can shrink to a pair of small triangles on each corner, the {201} never below a fifth of a unit
  const dl2 = max(min(lerp(-0.15, 1.3, T111), 0.36 * y1 + 0.18), 0.07);
  const dl3 = max(min(lerp(0.1, 1.1, T201), 0.24 * y1 + 0.12, 0.75 * kap * rho), 0.2); // the {201} band leaves a fifth of the termination to the {101} faces
  const y2 = max(y1 - dl2, -0.6), y3 = max(y1 - dl3, -0.4);
  const N1 = sqrt(1 + s * s), N2 = sqrt(2 + s * s), N3 = sqrt(4 + s * s);
  const { h, nx, ny, nz, wf } = S;
  for (let i = 0; i < NP; i++) {
    const f = FAM[i], hx = HX[i], hz = HZ[i], vs = VS[i];
    let x = hx, y = 0, z = hz, e;
    if (f === 2) (x = 0), (y = vs), (z = 0), (e = hc);
    else if (f >= 3) (y = vs * s), (e = f === 3 ? (1 + s * y1) / N1 : f === 4 ? (2 + s * y2) / N2 : (2 + s * y3) / N3);
    else e = f === 0 ? 1 : 1.4142 * tr;
    const il = 1 / sqrt(x * x + y * y + z * z);
    nx[i] = x * il; ny[i] = y * il; nz[i] = z * il;
    const w = 0.022 * sin(wf[i * 4] * t + wf[i * 4 + 1]) + 0.016 * sin(wf[i * 4 + 2] * t + wf[i * 4 + 3]);
    h[i] = max(0.3, e * (1 + w));
  }
  // the top and the bottom of the solid on its axis, and the centring
  let yt = 1e9, yb = 1e9;
  for (let i = 0; i < NP; i++) {
    if (ny[i] > 0.01) yt = min(yt, h[i] / ny[i]);
    else if (ny[i] < -0.01) yb = min(yb, -h[i] / ny[i]);
  }
  const yoff = (yt - yb) / 2;
  for (let i = 0; i < NP; i++) h[i] -= ny[i] * yoff;
  const L = (yt + yb) / 2;
  // the widest slice, at y = 0: clip a square by every plane, take the farthest corner
  let n = 4, P = S.px, Z = S.pz, Q = S.qx, R2 = S.qz;
  P[0] = -9; Z[0] = -9; P[1] = 9; Z[1] = -9; P[2] = 9; Z[2] = 9; P[3] = -9; Z[3] = 9;
  for (let i = 0; i < NP; i++) {
    const ax = nx[i], az = nz[i];
    if (abs(ax) + abs(az) < 1e-6) continue;
    let m = 0;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const dj = ax * P[j] + az * Z[j] - h[i], dk = ax * P[k] + az * Z[k] - h[i];
      if (dj <= 0) (Q[m] = P[j]), (R2[m] = Z[j]), m++;
      if ((dj <= 0) !== (dk <= 0)) {
        const r = dj / (dj - dk);
        Q[m] = P[j] + (P[k] - P[j]) * r;
        R2[m] = Z[j] + (Z[k] - Z[j]) * r;
        m++;
      }
    }
    const tp = P, tz = Z;
    P = Q; Z = R2; Q = tp; R2 = tz;
    n = m;
    if (n < 3) break;
  }
  let rl = 0.5;
  for (let j = 0; j < n; j++) rl = max(rl, sqrt(P[j] * P[j] + Z[j] * Z[j]));
  S.Rlat = rl;
  S.L = L;

  // ---- the view: a sway about the vertical axis and a nod, on sines that do not divide each other
  const sp = 0.6 + 0.9 * u;
  S.ph[0] += (TAU / 13.7) * sp * d; S.ph[1] += (TAU / 23.9) * sp * d; S.ph[2] += (TAU / 57.1) * sp * d;
  S.ph[3] += (TAU / 9.7) * sp * d; S.ph[4] += (TAU / 15.9) * sp * d; S.ph[5] += (TAU / 97.3) * sp * d;
  const Ay = (8 + 20 * u) * DEG;
  const psi = Ay * (0.42 * sin(S.ph[0]) + 0.24 * sin(S.ph[1]) + 0.12 * sin(S.ph[2]) + 0.22 * sin(S.ph[5]));
  const theta = (12 + 7.5 * u) * DEG + (1.5 + 1.5 * u) * DEG * (0.6 * sin(S.ph[3]) + 0.4 * sin(S.ph[4]));
  S.yaw = psi; S.tilt = theta;
  const cps = cos(psi), sps = sin(psi), cth = cos(theta), sth = sin(theta);

  // ---- the size: fit the panel, then grow and dissolve between 0.85 and 1
  // the crystal's centre drifts a few LEDs on slow sines, so it is never in quite the same place
  S.ox = 32 + 2.2 * sin((TAU * t) / 53.7 + 1.0) + 1.4 * sin((TAU * t) / 91.1 + 4.0);
  S.oy = 64 + 2.4 * sin((TAU * t) / 67.9 + 2.6) + 1.6 * sin((TAU * t) / 109.3 + 0.3);
  const size = 0.925 + 0.075 * dr(t, D_SZ);
  S.size = size;
  const fitW = 25 / rl, fitH = 59 / (L * cth + rl * sth);
  const scale = min(fitW, fitH) * size;
  S.scale = scale;

  // ---- the planes in the world, the slab tables and the light on each face
  const hue0 = k1;
  const ft = S.tmp, fcol = [];
  for (let f = 0; f < 6; f++) {
    // each family's hue breathes by 0.025 on a sine of its own, 83 to 137 s
    hsv(FHUE[f] + hue0 + 0.025 * sin((TAU * t) / (83 + 11 * f) + 1.7 * f), FSAT[f], 1, ft);
    fcol.push([ft[0], ft[1], ft[2]]);
  }
  // the key light walks slowly round the crystal, once in 383 s, so it is not in the same place twice within six minutes
  const la = 2.2 + (TAU * t) / 383;
  const lr = 78 + 16 * sin((TAU * t) / 61.1 + 2.0) + 8 * sin((TAU * t) / 37.9 + 5.2);
  S.kx = lr * cos(la);
  S.ky = 0.9 * lr * sin(la);
  S.kz = 82 + 14 * sin((TAU * t) / 71.3 + 4.4);
  // how bright the key is and how much the crystal glows from within, each on its own slow sines
  S.ki = 1.0 + 0.2 * (0.6 * sin((TAU * t) / 43.1 + 2.3) + 0.4 * sin((TAU * t) / 101.9 + 0.6));
  S.gl = 1 + 0.4 * (0.6 * sin((TAU * t) / 57.7 + 5.5) + 0.4 * sin((TAU * t) / 123.7 + 1.9));
  // lights, in the world: a cool fill from the right below here; the warm key is a point light, in draw
  const gx = 0.75, gy = -0.3, gz = 0.6, gl = 1 / sqrt(gx * gx + gy * gy + gz * gz);
  let ne = 0, nx2 = 0;
  for (let i = 0; i < NP; i++) {
    const x1 = nx[i] * cps + nz[i] * sps, z1 = -nx[i] * sps + nz[i] * cps, y1 = ny[i];
    const wy = y1 * cth - z1 * sth, wz = y1 * sth + z1 * cth, wx = x1;
    S.wx[i] = wx; S.wy[i] = wy; S.wz[i] = wz;
    const inv = 1 / (abs(wz) < 1e-4 ? (wz < 0 ? -1e-4 : 1e-4) : wz);
    const sc = scale;
    if (wz > 0) {
      S.ea[ne] = wx * inv; S.eb[ne] = wy * inv; S.ec[ne] = -h[i] * sc * inv; S.ei[ne] = i; ne++;
      S.d2[i] = max(0, (wx * gx + wy * gy + wz * gz) * gl);
      const fr = (1 - wz);
      S.fr[i] = fr * fr * fr;
    } else {
      S.xa[nx2] = wx * inv; S.xb[nx2] = wy * inv; S.xc[nx2] = -h[i] * sc * inv; S.xi[nx2] = i; nx2++;
    }
    const c = fcol[FAM[i]];
    S.tr[i] = c[0]; S.tg[i] = c[1]; S.tb[i] = c[2];
    // for the growth zones: the gauge of the solid, n . x / h, in LEDs
    const zh = 1 / (h[i] * scale);
    S.zx[i] = wx * zh; S.zy[i] = wy * zh; S.zz[i] = wz * zh;
  }
  S.ne = ne; S.nx2 = nx2;

  // the ground and the halo behind the crystal
  hsv(0.7 + 0.12 * sin(TAU * hue0), 0.82, 1, ft); // the ground stays between teal blue and violet whatever the hue
  S.gcol[0] = ft[0]; S.gcol[1] = ft[1]; S.gcol[2] = ft[2];
  const hw = rl * scale * 2.1, hh = (L * cth + rl * sth) * scale * 1.3;
  for (let x = 0; x < W; x++) {
    const dx = (x + 0.5 - S.ox) / hw;
    S.hx[x] = exp(-dx * dx * 1.4);
  }
  for (let y = 0; y < H; y++) {
    const dy = (y + 0.5 - S.oy) / hh;
    S.hy[y] = exp(-dy * dy * 1.4);
  }
}

// does the ray of the pixel at (px, py) pass through the solid: the largest entry t is less than the smallest exit t
function inside(px, py, S) {
  const { ne, nx2, ea, eb, ec, xa, xb, xc } = S;
  let te = -1e18;
  for (let k = 0; k < ne; k++) {
    const tt = ec[k] + py * eb[k] + px * ea[k];
    if (tt > te) te = tt;
  }
  for (let k = 0; k < nx2; k++) if (xc[k] + py * xb[k] + px * xa[k] <= te) return 0;
  return 1;
}

export function draw(display, params) {
  const S = params.s;
  if (!S) return;
  const { ne, nx2, ea, eb, ec, ei, xa, xb, xc, xi, rowE, rowX, wx, wy, wz, tr, tg, tb, fr, d2, zx, zy, zz, cnt } = S;
  const scale = S.scale;
  const hy = (S.L * cos(S.tilt) + S.Rlat * sin(S.tilt)) * scale;
  const ox = S.ox, oy = S.oy;
  const x0 = max(0, floor(ox - S.Rlat * scale - 2)), x1 = min(W - 1, floor(ox + S.Rlat * scale + 2));
  const y0 = max(0, floor(oy - hy - 3)), y1 = min(H - 1, floor(oy + hy + 3));
  cnt.fill(0);
  const gc = S.gcol, hxv = S.hx, hyv = S.hy;
  // the warm key is a point light up and to the left in front of the crystal, near enough that its diffuse light and its glint change across a face
  const KPX = S.kx, KPY = S.ky, KPZ = S.kz, KI = S.ki, GL = S.gl;
  const sc2 = 1 / 26;
  for (let y = 0; y < H; y++) {
    const gyf = y / (H - 1);
    const inRow = y >= y0 && y <= y1;
    const py = -(y + 0.5 - oy);
    if (inRow) {
      for (let k = 0; k < ne; k++) rowE[k] = ec[k] + py * eb[k];
      for (let k = 0; k < nx2; k++) rowX[k] = xc[k] + py * xb[k];
    }
    // the ground: indigo, a little lighter at the top, plus the halo
    const gv = 0.095 + 0.06 * (1 - gyf), hv = 0.17 * hyv[y];
    for (let x = 0; x < W; x++) {
      const halo = hv * hxv[x];
      let R = gc[0] * gv + (gc[0] * 0.8 + 0.1) * halo, G = gc[1] * gv + (gc[1] * 0.8 + 0.05) * halo, B = gc[2] * gv + (gc[2] * 0.9 + 0.1) * halo;
      if (inRow && x >= x0 && x <= x1) {
        const px = x + 0.5 - ox;
        let te1 = -1e18, te2 = -1e18, ie1 = 0, ie2 = 0;
        for (let k = 0; k < ne; k++) {
          const tt = rowE[k] + px * ea[k];
          if (tt > te1) (te2 = te1), (ie2 = ie1), (te1 = tt), (ie1 = k);
          else if (tt > te2) (te2 = tt), (ie2 = k);
        }
        let tx1 = 1e18, tx2 = 1e18, ix1 = 0, ix2 = 0;
        for (let k = 0; k < nx2; k++) {
          const tt = rowX[k] + px * xa[k];
          if (tt < tx1) (tx2 = tx1), (ix2 = ix1), (tx1 = tt), (ix1 = k);
          else if (tt < tx2) (tx2 = tt), (ix2 = k);
        }
        const g = tx1 - te1;
        const gxr = xa[ix1] - ea[ie1], gyr = xb[ix1] - eb[ie1];
        const dsil = g / max(sqrt(gxr * gxr + gyr * gyr), 0.05);
        // the distance g / |grad| only knows the two planes that decide this ray, so near the outline the coverage is counted on 3 by 3 rays
        let cov = 1;
        if (dsil < -1.5) cov = 0;
        else if (dsil < 1.5) {
          let hits = 0;
          for (let v = -1; v <= 1; v++)
            for (let u = -1; u <= 1; u++) hits += inside(px + u * 0.3333, py + v * 0.3333, S);
          cov = hits * 0.1111;
        }
        if (cov > 0) {
          const face = ei[ie1], bxi = xi[ix1];
          cnt[face] += cov > 0.5 ? 1 : 0;
          const T = g > 0 ? g : 0;
          const inner = 1 - exp(-T * sc2);
          // the hit point in the world is (px, py, -te1)
          const pz = -te1, nxw = wx[face], nyw = wy[face], nzw = wz[face];
          let lx = KPX - px, ly = KPY - py, lz = KPZ - pz;
          const il = 1 / sqrt(lx * lx + ly * ly + lz * lz);
          lx *= il; ly *= il; lz *= il;
          const dif1 = max(0, nxw * lx + nyw * ly + nzw * lz);
          // the face: its tint, lit warm by the key and cool by the fill, then dimmed where the crystal is thick
          const df2 = d2[face];
          const wr = 0.2 + dif1 * 0.9 + df2 * 0.18, wg = 0.2 + dif1 * 0.82 + df2 * 0.3, wb = 0.2 + dif1 * 0.66 + df2 * 0.55;
          const lit = (0.22 + 0.74 * (0.9 * dif1 + 0.36 * df2)) / ((wr + wg + wb) / 3);
          const fdim = (1 - 0.3 * inner) * lit * KI;
          let r = tr[face] * wr * fdim, gg = tg[face] * wg * fdim, b = tb[face] * wb * fdim;
          // glow from within, in the colour of the face it comes out through, a little lightened
          const gi = inner * (0.1 + 0.4 * inner) * GL;
          const mr = 0.88 * tr[face] + 0.12, mg = 0.88 * tg[face] + 0.12, mb = 0.88 * tb[face] + 0.12;
          r += mr * gi; gg += mg * gi; b += mb * gi;
          // Fresnel, a soft gloss and the glint, a narrow lobe of the half vector
          const hzz = lz + 1, hn = nxw * lx + nyw * ly + nzw * hzz;
          let spec = 0, gloss = 0;
          if (hn > 0) {
            const nh = hn / sqrt(2 + 2 * lz);
            if (nh > 0.6) {
              const n2 = nh * nh, n4 = n2 * n2, n8 = n4 * n4, n16 = n8 * n8, n32 = n16 * n16, n64 = n32 * n32, n128 = n64 * n64;
              spec = n128 * n128 * 0.6;
              gloss = n16 * 0.07;
            }
          }
          const fz = fr[face] * 0.42 + gloss;
          r += (tr[face] * 0.5 + 0.5) * fz + spec;
          gg += (tg[face] * 0.5 + 0.5) * fz + spec * 0.97;
          b += (tb[face] * 0.5 + 0.5) * fz + spec * 0.92;
          // growth zones: the gauge of the solid at the middle of the ray, drawn at two levels as faint nested copies of the crystal
          if (T > 4) {
            const tm = 0.5 * (te1 + tx1);
            let phi = -1e9;
            for (let k = 0; k < NP; k++) {
              const v = zx[k] * px + zy[k] * py - zz[k] * tm;
              if (v > phi) phi = v;
            }
            const z1 = (phi - 0.3) / 0.045, z2 = (phi - 0.62) / 0.045;
            const zone = (exp(-z1 * z1) + exp(-z2 * z2)) * 0.15 * inner;
            r += mr * zone + zone * 0.3; gg += mg * zone + zone * 0.3; b += mb * zone + zone * 0.3;
          }
          // the edge to the next face in front, in LEDs: bright, about two LEDs wide
          const f2 = ei[ie2];
          const dgx = ea[ie1] - ea[ie2], dgy = eb[ie1] - eb[ie2];
          const de = (te1 - te2) / max(sqrt(dgx * dgx + dgy * dgy), 0.05);
          const dot = nxw * wx[f2] + nyw * wy[f2] + nzw * wz[f2];
          const ew = cl(1.7 * (1 - dot), 0.65, 1);
          const edge = exp(-(de * de) / 1.5) * ew;
          r += edge * 0.95; gg += edge * 0.9; b += edge * 0.85;
          // the edges of the back faces seen through the glass, faint and cool
          const dgx2 = xa[ix1] - xa[ix2], dgy2 = xb[ix1] - xb[ix2];
          const db = (tx2 - tx1) / max(sqrt(dgx2 * dgx2 + dgy2 * dgy2), 0.05);
          const back = exp(-(db * db) / 1.3) * (0.1 + 0.6 * inner) * 0.4;
          r += (tr[bxi] * 0.25 + 0.75) * back; gg += (tg[bxi] * 0.25 + 0.75) * back; b += (tb[bxi] * 0.25 + 0.75) * back;
          // the rim of the outline
          const ds = dsil > 0 ? dsil : 0;
          const rim = exp(-(ds * ds) / 1.7) * 0.5;
          r += (tr[face] * 0.4 + 0.6) * rim; gg += (tg[face] * 0.4 + 0.6) * rim; b += (tb[face] * 0.4 + 0.6) * rim;
          // a soft shoulder on the brightest channel, so a bright amber stays amber, then over the ground
          const mx = max(r, gg, b, 1e-4), kf = (1.287 * (1 - exp(-1.5 * mx))) / mx;
          r *= kf; gg *= kf; b *= kf;
          R += (r - R) * cov; G += (gg - G) * cov; B += (b - B) * cov;
        }
      }
      display.setPixel(x, y, R < 0 ? 0 : R > 1 ? 255 : (R * 255 + 0.5) | 0, G < 0 ? 0 : G > 1 ? 255 : (G * 255 + 0.5) | 0, B < 0 ? 0 : B > 1 ? 255 : (B * 255 + 0.5) | 0);
    }
  }
  let nf = 0;
  for (let i = 0; i < NP; i++) if (cnt[i] >= 5) nf++;
  S.nfaces = nf;
}
